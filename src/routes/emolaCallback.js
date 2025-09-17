const express = require('express');
const router = express.Router();
const Pagamento = require('../models/pagamentoModel');

router.post('/callback', async (req, res) => {
  const { reqeustId, transId, refNo, errorCode, message } = req.body;

  console.log("📩 Callback recebido do eMola:", req.body);

  try {
    // Atualiza status do pagamento na BD
    await Pagamento.findOneAndUpdate(
      { transId },
      { status: errorCode === "01" ? "aprovado" : "falhou" },
      { new: true }
    );

    res.json({ ResponseCode: "0", ResponseMessage: "Received" });
  } catch (error) {
    console.error("Erro ao processar callback:", error);
    res.status(500).json({ ResponseCode: "1", ResponseMessage: "Erro interno" });
  }
});

module.exports = router;
