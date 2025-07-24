// routes/pagamentoRoutes.js
const express = require("express");
const router = express.Router();
const Pagamento = require("../models/pagamentoModel");
const verificarToken = require("../middleware/authMiddleware");

// A rota de callback M-Pesa foi movida para o server.js para lidar com express.raw
// const { mpesaCallbackHandler } = require("../controllers/mpesaCallbackController"); // Não é mais necessário importar aqui
const { iniciarSTKPush } = require("../services/mpesaService");

// --- Rota para criar um pagamento ---
router.post("/", verificarToken, async (req, res) => {
    const { pacote, formaPagamento, preco, telefone, dadosCartao, status } = req.body;
    const usuarioId = req.usuario.id;

    console.log(`Recebendo solicitação de pagamento para o usuário ${usuarioId}`);

    if (!pacote || !formaPagamento || preco === undefined || preco === null) {
        console.error("Erro de validação: Pacote, forma de pagamento e preço são obrigatórios.");
        return res.status(400).json({
            sucesso: false,
            mensagem: "Pacote, forma de pagamento e preço são obrigatórios.",
        });
    }

    if (formaPagamento === "Cartão" && (!dadosCartao || !dadosCartao.numeroFinal)) {
        console.error("Erro de validação: Dados do cartão ausentes ou incompletos.");
        return res.status(400).json({ sucesso: false, mensagem: "Dados do cartão ausentes ou incompletos." });
    }

    if (formaPagamento === "M-Pesa" && !telefone) {
        console.error("Erro de validação: Telefone ausente para pagamento M-Pesa.");
        return res.status(400).json({ sucesso: false, mensagem: "Telefone ausente para pagamento M-Pesa." });
    }

    try {
        let mpesaInfo = null;
        let pagamentoSalvo;

        if (formaPagamento === "M-Pesa") {
            const accountReference = `ASSINATURA-${usuarioId}-${Date.now()}`;
            const formattedPhoneNumber = telefone.startsWith("258") ? telefone : `258${telefone}`;

            console.log(`Iniciando STK Push para ${formattedPhoneNumber} com valor ${preco} MZN, Ref: ${accountReference}`);

            try {
                const respostaSTK = await iniciarSTKPush(preco, formattedPhoneNumber, accountReference, `Pagamento de assinatura ${pacote}`);

                if (respostaSTK.output_ResponseCode === "INS-0") {
                    mpesaInfo = {
                        transactionReference: accountReference,
                        responseCode: respostaSTK.output_ResponseCode,
                        responseDesc: respostaSTK.output_ResponseDescription,
                        merchantRequestId: respostaSTK.output_MerchantRequestID,
                        checkoutRequestId: respostaSTK.output_CheckoutRequestID,
                        customerMessage: respostaSTK.output_CustomerMessage,
                        mpesaStatus: "pendente_stk",
                        rawCallback: {}
                    };

                    const novoPagamento = new Pagamento({
                        pacote,
                        formaPagamento,
                        preco,
                        telefone: formattedPhoneNumber,
                        status: "pendente",
                        usuario: usuarioId,
                        mpesa: mpesaInfo,
                    });

                    pagamentoSalvo = await novoPagamento.save();

                    console.log("Pagamento M-Pesa iniciado e registrado como 'pendente' no DB.");

                    return res.json({
                        sucesso: true,
                        mensagem: "Solicitação M-Pesa enviada com sucesso! Aguardando confirmação do usuário no telefone.",
                        pagamento: pagamentoSalvo,
                        mpesaResponse: {
                            merchantRequestId: respostaSTK.output_MerchantRequestID,
                            checkoutRequestId: respostaSTK.output_CheckoutRequestID,
                            responseDescription: respostaSTK.output_ResponseDescription,
                        }
                    });
                } else {
                    console.error("Erro ao iniciar STK Push M-Pesa:", respostaSTK.output_ResponseDescription);
                    return res.status(400).json({
                        sucesso: false,
                        mensagem: `Erro ao iniciar pagamento M-Pesa: ${respostaSTK.output_ResponseDescription || 'Erro desconhecido.'}`,
                        mpesaResponse: respostaSTK
                    });
                }
            } catch (error) {
                console.error("Exceção durante o STK Push:", error);
                return res.status(500).json({
                    sucesso: false,
                    mensagem: `Erro interno ao tentar iniciar pagamento M-Pesa: ${error.message}`,
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

        pagamentoSalvo = await novoPagamento.save();

        console.log("Pagamento (não M-Pesa) realizado com sucesso e salvo no DB.");

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

// --- Rota para consultar o status de um pagamento pelo ID ---
router.get("/:id", verificarToken, async (req, res) => {
    const pagamentoId = req.params.id;

    console.log(`Consultando status do pagamento com ID: ${pagamentoId}`);

    try {
        const pagamento = await Pagamento.findById(pagamentoId).populate("usuario");

        if (!pagamento) {
            console.error("Pagamento não encontrado.");
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

// --- Rota para cancelar um pagamento ---
router.delete("/:id", verificarToken, async (req, res) => {
    const pagamentoId = req.params.id;

    console.log(`Tentando cancelar o pagamento com ID: ${pagamentoId}`);

    try {
        const pagamento = await Pagamento.findById(pagamentoId);

        if (!pagamento) {
            console.error("Pagamento não encontrado.");
            return res.status(404).json({
                sucesso: false,
                mensagem: "Pagamento não encontrado.",
            });
        }

        if (pagamento.status !== "pendente") {
            console.error("Não é possível cancelar um pagamento que já foi processado.");
            return res.status(400).json({
                sucesso: false,
                mensagem: "Não é possível cancelar um pagamento que já foi processado.",
            });
        }

        pagamento.status = "cancelado";
        if (pagamento.formaPagamento === "M-Pesa") {
            pagamento.mpesa.mpesaStatus = "cancelado";
        }
        await pagamento.save();

        console.log(`Pagamento com ID ${pagamentoId} cancelado com sucesso.`);

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

// --- Rota para CONFIRMAR/ATUALIZAR um pagamento (uso cauteloso para M-Pesa) ---
router.put("/confirmacao/:id", verificarToken, async (req, res) => {
    const pagamentoId = req.params.id;
    const { status } = req.body;

    console.log(`Recebendo solicitação de atualização de status para o pagamento ID: ${pagamentoId} para status: ${status}`);

    try {
        const pagamento = await Pagamento.findById(pagamentoId);

        if (!pagamento) {
            console.error("Pagamento não encontrado.");
            return res.status(404).json({
                sucesso: false,
                mensagem: "Pagamento não encontrado.",
            });
        }

        if (pagamento.formaPagamento === "M-Pesa" && pagamento.status !== "pendente") {
             console.warn(`Tentativa de atualização manual de pagamento M-Pesa não pendente (ID: ${pagamentoId}). O callback M-Pesa é a fonte da verdade.`);
             return res.status(400).json({
                 sucesso: false,
                 mensagem: "O status de pagamentos M-Pesa é atualizado automaticamente pelo callback. Esta operação não é permitida para pagamentos M-Pesa não pendentes.",
             });
        }
        
        if (['pago', 'falhou', 'cancelado'].includes(status)) {
            pagamento.status = status;
            if (pagamento.formaPagamento === "M-Pesa") {
                if (status === 'pago') pagamento.mpesa.mpesaStatus = 'sucesso';
                else if (status === 'falhou') pagamento.mpesa.mpesaStatus = 'falha';
                else if (status === 'cancelado') pagamento.mpesa.mpesaStatus = 'cancelado';
            }
        } else {
            return res.status(400).json({ sucesso: false, mensagem: "Status de atualização inválido. Use 'pago', 'falhou' ou 'cancelado'." });
        }
        
        await pagamento.save();

        console.log(`Pagamento com ID ${pagamentoId} atualizado para status: ${pagamento.status}.`);

        return res.json({
            sucesso: true,
            mensagem: `Pagamento ${pagamento.status}.`,
            pagamento,
        });

    } catch (error) {
        console.error("Erro ao confirmar/atualizar pagamento:", error);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao confirmar/atualizar pagamento.",
        });
    }
});

module.exports = router;