// routes/webhookMpesa.js
const express = require('express');
const router = express.Router();
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');

// Webhook oficial da Vodacom M-Pesa
router.post('/mpesa', async (req, res) => {
  console.log('[WEBHOOK MPESA] Recebido:', JSON.stringify(req.body, null, 2));

  const { output_ThirdPartyReference, output_ResponseCode, output_TransactionID } = req.body;

  if (!output_ThirdPartyReference) {
    return res.status(400).json({ success: false, error: 'Falta referência' });
  }

  try {
    const pagamento = await Pagamento.findOne({
      'gatewayResponse.reference': output_ThirdPartyReference,
      status: 'pendente'
    }).populate('anuncioId');

    if (!pagamento) {
      console.log('[WEBHOOK] Pagamento não encontrado ou já processado');
      return res.json({ success: true }); // evita retry infinito
    }

    if (output_ResponseCode === '00' || req.body.output_TransactionStatus === 'Completed') {
      pagamento.status = 'aprovado';
      pagamento.dataPagamento = new Date();
      pagamento.gatewayResponse.transactionId = output_TransactionID;
      await pagamento.save();

      // ATIVAÇÃO REAL ACONTECE AQUI!
      if (pagamento.anuncioId) {
        const weeks = pagamento.anuncioId.weeks || 1;
        await Anuncio.findByIdAndUpdate(pagamento.anuncioId, {
          status: 'active',
          dataAtivacao: new Date(),
          dataExpiracao: new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000)
        });
      }

      console.log(`[WEBHOOK] Pagamento APROVADO: ${output_ThirdPartyReference}`);
    } else {
      pagamento.status = 'falhou';
      await pagamento.save();
      console.log(`[WEBHOOK] Pagamento REJEITADO: ${output_ThirdPartyReference}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[WEBHOOK] Erro interno:', err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;