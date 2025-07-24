const express = require("express");
const router = express.Router();
const Pagamento = require("../models/pagamentoModel");
const verificarToken = require("../middleware/authMiddleware");

const { mpesaCallbackHandler } = require("../controllers/mpesaCallbackController");
const { iniciarSTKPush } = require("../services/mpesaService");

/**
 * Rota pública para o callback da M-Pesa.
 * Esta rota será chamada pela M-Pesa para notificar o sistema sobre o status do pagamento.
 */
router.post("/mpesa/callback", mpesaCallbackHandler);

/**
 * Criar um pagamento
 * Essa rota exige que o usuário esteja autenticado (verificado pelo token de autenticação)
 */
// Criar pagamento
router.post("/", verificarToken, async (req, res) => {
    const { pacote, formaPagamento, preco, telefone, dadosCartao, status } = req.body;
    const usuarioId = req.usuario.id;

    if (!pacote || !formaPagamento || preco === undefined || preco === null) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Pacote, forma de pagamento e preço são obrigatórios.",
        });
    }

    if (formaPagamento === "Cartão" && !dadosCartao?.numero) {
        return res.status(400).json({ sucesso: false, mensagem: "Dados do cartão ausentes." });
    }

    if (formaPagamento === "M-Pesa" && !telefone) {
        return res.status(400).json({ sucesso: false, mensagem: "Telefone ausente." });
    }

    try {
        let mpesaInfo = null;

        if (formaPagamento === "M-Pesa") {
            const accountReference = `ASSINATURA-${usuarioId}-${Date.now()}`;

            try {
                const respostaSTK = await iniciarSTKPush(preco, telefone, accountReference, `Pagamento de assinatura ${pacote}`);

                if (respostaSTK.output_ResponseCode === "INS-0") {
                    mpesaInfo = {
                        merchantRequestId: respostaSTK.output_MerchantRequestID,
                        checkoutRequestId: respostaSTK.output_CheckoutRequestID,
                        responseCode: respostaSTK.output_ResponseCode,
                        customerMessage: respostaSTK.output_CustomerMessage,
                        status: "pendente",
                        accountReference: accountReference,
                    };

                    const novoPagamento = new Pagamento({
                        pacote,
                        formaPagamento,
                        preco,
                        telefone,
                        status: "pendente",
                        usuario: usuarioId,
                        mpesa: mpesaInfo,
                    });

                    const pagamentoSalvo = await novoPagamento.save();

                    return res.json({
                        sucesso: true,
                        mensagem: "Solicitação M-Pesa enviada com sucesso! Aguardando confirmação do usuário.",
                        pagamento: pagamentoSalvo,
                        mpesaResponse: {
                            merchantRequestId: respostaSTK.output_MerchantRequestID,
                            checkoutRequestId: respostaSTK.output_CheckoutRequestID,
                            responseDescription: respostaSTK.output_ResponseDescription,
                        }
                    });
                } else {
                    return res.status(400).json({
                        sucesso: false,
                        mensagem: `Erro ao iniciar pagamento M-Pesa: ${respostaSTK.output_ResponseDescription || 'Erro desconhecido.'}`,
                        mpesaResponse: respostaSTK
                    });
                }
            } catch (error) {
                console.error("Erro no fluxo do STK Push:", error);
                return res.status(500).json({
                    sucesso: false,
                    mensagem: `Erro ao tentar iniciar pagamento M-Pesa: ${error.message}`,
                });
            }
        }

        const novoPagamento = new Pagamento({
            pacote,
            formaPagamento,
            preco,
            telefone: telefone || null,
            cartao: dadosCartao || null,
            status: status || "pago",
            usuario: usuarioId,
            mpesa: mpesaInfo,
        });

        const pagamentoSalvo = await novoPagamento.save();

        return res.json({
            sucesso: true,
            mensagem: "Pagamento iniciado/salvo com sucesso.",
            pagamento: pagamentoSalvo,
        });

    } catch (error) {
        console.error("Erro geral ao processar pagamento:", error);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno do servidor." });
    }
});


/**
 * Rota para consultar o status de um pagamento pelo ID.
 * A consulta do status pode ser útil para verificar o pagamento realizado via M-Pesa ou cartão.
 */
router.get("/:id", verificarToken, async (req, res) => {
    const pagamentoId = req.params.id;

    try {
        const pagamento = await Pagamento.findById(pagamentoId).populate("usuario");

        if (!pagamento) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Pagamento não encontrado.",
            });
        }

        return res.json({
            sucesso: true,
            pagamento,
        });

    } catch (error) {
        console.error("Erro ao consultar pagamento:", error);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao consultar pagamento.",
        });
    }
});

/**
 * Rota para cancelar um pagamento (caso o status ainda seja 'pendente').
 * Esta rota pode ser útil caso o usuário queira desistir do pagamento antes de ser processado.
 */
router.delete("/:id", verificarToken, async (req, res) => {
    const pagamentoId = req.params.id;

    try {
        const pagamento = await Pagamento.findById(pagamentoId);

        if (!pagamento) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Pagamento não encontrado.",
            });
        }

        if (pagamento.status !== "pendente") {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Não é possível cancelar um pagamento que já foi processado.",
            });
        }

        // Atualiza o status para 'cancelado'
        pagamento.status = "cancelado";
        await pagamento.save();

        return res.json({
            sucesso: true,
            mensagem: "Pagamento cancelado com sucesso.",
            pagamento,
        });

    } catch (error) {
        console.error("Erro ao cancelar pagamento:", error);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao cancelar pagamento.",
        });
    }
});

/**
 * Rota para realizar o pagamento finalizado via M-Pesa após a confirmação de pagamento.
 * Esta rota pode ser usada para confirmar que o pagamento foi bem-sucedido e foi processado pela M-Pesa.
 */
router.put("/confirmacao/:id", verificarToken, async (req, res) => {
    const pagamentoId = req.params.id;
    const { merchantRequestId, checkoutRequestId, status } = req.body;

    try {
        const pagamento = await Pagamento.findById(pagamentoId);

        if (!pagamento) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Pagamento não encontrado.",
            });
        }

        // Se o pagamento já foi confirmado, não há necessidade de confirmar novamente
        if (pagamento.status !== "pendente") {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Este pagamento já foi confirmado ou cancelado.",
            });
        }

        // Atualiza o status do pagamento com base na resposta da M-Pesa
        if (status === "sucesso") {
            pagamento.status = "pago";
        } else {
            pagamento.status = "falhou";
        }

        pagamento.mpesa.merchantRequestId = merchantRequestId;
        pagamento.mpesa.checkoutRequestId = checkoutRequestId;
        pagamento.mpesa.status = status;

        await pagamento.save();

        return res.json({
            sucesso: true,
            mensagem: `Pagamento ${status === "sucesso" ? "realizado" : "falhou"}`,
            pagamento,
        });

    } catch (error) {
        console.error("Erro ao confirmar pagamento:", error);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao confirmar pagamento.",
        });
    }
});

module.exports = router;
