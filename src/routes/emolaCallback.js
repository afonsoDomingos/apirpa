const express = require('express');
const router = express.Router();
const Pagamento = require('../models/pagamentoModel');
const Usuario = require('../models/usuarioModel');
const webhookNotifier = require('../services/webhookNotifier');

router.post('/callback', async (req, res) => {
  const { reqeustId, transId, refNo, errorCode, message } = req.body;

  console.log("📩 Callback recebido do eMola:", req.body);

  try {
    // Atualiza status do pagamento na BD
    const pagamento = await Pagamento.findOneAndUpdate(
      { transId },
      {
        status: errorCode === "01" ? "aprovado" : "falhou",
        dataPagamento: errorCode === "01" ? new Date() : undefined
      },
      { new: true }
    ).populate('usuarioId');

    if (pagamento && errorCode === "01") {
      // 🔔 ENVIAR NOTIFICAÇÕES WEBHOOK
      await webhookNotifier.sendWebhookNotification(pagamento.usuarioId._id, 'payment.approved', {
        pagamentoId: pagamento._id.toString(),
        usuarioNome: pagamento.usuarioId?.nome,
        usuarioEmail: pagamento.usuarioId?.email,
        valor: pagamento.valor,
        pacote: pagamento.pacote,
        metodoPagamento: pagamento.metodoPagamento,
        tipoPagamento: pagamento.tipoPagamento,
        dataPagamento: pagamento.dataPagamento,
        referencia: pagamento.referencia
      });
    }

    res.json({ ResponseCode: "0", ResponseMessage: "Received" });
  } catch (error) {
    console.error("Erro ao processar callback:", error);
    res.status(500).json({ ResponseCode: "1", ResponseMessage: "Erro interno" });
  }
});

module.exports = router;
