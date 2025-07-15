// routes/pagamentos.js
const express = require("express");
const router = express.Router();
const Pagamento = require("../models/pagamentoModel");
const verificarToken = require("../middleware/authMiddleware");

// Importe o handler de callback
const { mpesaCallbackHandler } = require("../controllers/mpesaCallbackController");
// Importe a nova função STK Push
const { iniciarSTKPush } = require("../services/mpesaService");

// --- Nova Rota para Callback M-Pesa (SEM AUTENTICAÇÃO!) ---
router.post("/mpesa/callback", mpesaCallbackHandler);
// -----------------------------------------------------------

// Criar um pagamento (requer login)
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

    if ((formaPagamento === "M-Pesa") && !telefone) { // Removi Emola para focar
        return res.status(400).json({ sucesso: false, mensagem: "Telefone ausente." });
    }

    try {
        let mpesaInfo = null;

        if (formaPagamento === "M-Pesa") {
            // Gerar uma referência única para o STK Push
            const accountReference = `ASSINATURA-${usuarioId}-${Date.now()}`;

            try {
                const respostaSTK = await iniciarSTKPush({
                    amount: preco,
                    phoneNumber: telefone,
                    accountReference: accountReference,
                    transactionDesc: `Pagamento de assinatura ${pacote}`,
                });

                // Verifica se a solicitação foi aceita pela Safaricom
                if (respostaSTK.ResponseCode === "0") {
                    mpesaInfo = {
                        merchantRequestId: respostaSTK.MerchantRequestID,
                        checkoutRequestId: respostaSTK.CheckoutRequestID,
                        responseCode: respostaSTK.ResponseCode,
                        customerMessage: respostaSTK.CustomerMessage,
                        status: "pendente", // O status inicial é pendente até o callback
                        accountReference: accountReference, // Salva a referência para uso no callback
                    };

                    // Salva o pagamento no DB com status "pendente"
                    const novoPagamento = new Pagamento({
                        pacote,
                        formaPagamento,
                        preco,
                        telefone: telefone,
                        status: "pendente",
                        data: new Date(),
                        usuario: usuarioId,
                        mpesa: mpesaInfo,
                    });

                    const pagamentoSalvo = await novoPagamento.save();

                    return res.json({
                        sucesso: true,
                        mensagem: "Solicitação M-Pesa enviada com sucesso! Aguardando confirmação do usuário.",
                        pagamento: pagamentoSalvo,
                        mpesaResponse: {
                            merchantRequestId: respostaSTK.MerchantRequestID,
                            checkoutRequestId: respostaSTK.CheckoutRequestID,
                            responseDescription: respostaSTK.ResponseDescription,
                        }
                    });
                } else {
                    // M-Pesa recusou a solicitação inicial (ex: número inválido, credenciais erradas)
                    return res.status(400).json({
                        sucesso: false,
                        mensagem: `Erro ao iniciar pagamento M-Pesa: ${respostaSTK.ResponseDescription || 'Erro desconhecido.'}`,
                        mpesaResponse: respostaSTK
                    });
                }

            } catch (error) {
                console.error("Erro no fluxo do STK Push (catch interno):", error);
                return res.status(500).json({
                    sucesso: false,
                    mensagem: `Erro ao tentar iniciar pagamento M-Pesa: ${error.message}`,
                });
            }
        }

        // Para outras formas de pagamento (Cartão, Emola, etc.)
        const novoPagamento = new Pagamento({
            pacote,
            formaPagamento,
            preco,
            telefone: telefone || null,
            cartao: dadosCartao || null,
            status: status || "pago", // Assumindo pago para outras formas, ajuste conforme sua lógica
            data: new Date(),
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

// Listar pagamentos do usuário logado com validade e status dinâmico
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const pagamentos = await Pagamento.find({ usuario: usuarioId }).sort({ data: -1 });

    const hoje = new Date();

    const pagamentosComValidade = pagamentos.map(pag => {
      const validade = new Date(pag.data);
      const nomePacote = pag.pacote?.toLowerCase().trim();
      const diasDeValidade = nomePacote === "anual" ? 365 : 30;

      validade.setDate(validade.getDate() + diasDeValidade);

      const diffMs = validade - hoje;
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const expirado = diasRestantes < 0;
      const status = expirado ? 'expirado' : 'pago';

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status
      };
    });

    res.json({
      sucesso: true,
      total: pagamentos.length,
      pagamentos: pagamentosComValidade,
    });
  } catch (error) {
    console.error("Erro ao buscar pagamentos do usuário:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar pagamentos.",
    });
  }
});

// Buscar pagamento por ID (só dono ou admin)
router.get("/:id", verificarToken, async (req, res) => {
  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) {
      return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });
    }

    if (pagamento.usuario.toString() !== req.usuario.id && req.usuario.role !== "admin") {
      return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
    }

    res.json({ sucesso: true, pagamento: pagamento.toObject() });
  } catch (error) {
    console.error("Erro ao buscar pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar pagamento." });
  }
});

// Excluir pagamento (admin)
router.delete("/:id", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamentoRemovido = await Pagamento.findByIdAndDelete(req.params.id);
    if (!pagamentoRemovido) {
      return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });
    }
    res.json({ sucesso: true, mensagem: "Pagamento removido com sucesso." });
  } catch (error) {
    console.error("Erro ao remover pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao remover pagamento." });
  }
});

// Verificar assinatura ativa
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const pagamentoMaisRecente = await Pagamento.findOne({ usuario: usuarioId }).sort({ data: -1 });

    if (!pagamentoMaisRecente) {
      return res.json({ ativa: false, diasRestantes: null });
    }

    const nomePacote = pagamentoMaisRecente.pacote?.toLowerCase().trim();
    const diasDeValidade = nomePacote === "anual" ? 365 : 30;

    const validade = new Date(pagamentoMaisRecente.data);
    validade.setDate(validade.getDate() + diasDeValidade);

    const hoje = new Date();
    const diffMs = validade - hoje;
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const assinaturaAtiva = diasRestantes >= 0;

    return res.json({ ativa: assinaturaAtiva, diasRestantes });
  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar assinatura." });
  }
});

module.exports = router;