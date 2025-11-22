// src/routes/webhookMpesa.js
const express = require('express');
const router = express.Router();
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');

// WEBHOOK OFICIAL M-PESA MOÇAMBIQUE
router.post('/mpesa', async (req, res) => {
  console.log('[WEBHOOK MPESA] Recebido completo:', JSON.stringify(req.body, null, 2));

  const {
    output_ThirdPartyReference,
    output_ResponseCode,
    output_ConversationID,
    output_TransactionStatus
  } = req.body;

  // Se não vier a referência única → ignora
  if (!output_ThirdPartyReference) {
    console.log('[WEBHOOK] Ignorado: falta output_ThirdPartyReference');
    return res.json({ success: true });
  }

  try {
    // Procura o pagamento pela referência única que tu geraste (RPA123456...)
    const pagamento = await Pagamento.findOne({
      'gatewayResponse.reference': output_ThirdPartyReference
    }).populate('anuncioId');

    if (!pagamento) {
      console.log('[WEBHOOK] Pagamento não encontrado com referência:', output_ThirdPartyReference);
      return res.json({ success: true }); // evita retry infinito
    }

    // Se já foi processado → ignora
    if (pagamento.status === 'aprovado' || pagamento.status === 'falhou') {
      console.log('[WEBHOOK] Já processado antes:', output_ThirdPartyReference);
      return res.json({ success: true });
    }

    // PAGAMENTO APROVADO
    if (output_ResponseCode === '00' || output_TransactionStatus === 'Completed') {
      pagamento.status = 'aprovado';
      pagamento.dataPagamento = new Date();
      pagamento.gatewayResponse.transactionId = output_ConversationID;
      await pagamento.save();

      // ATIVA O ANÚNCIO
      if (pagamento.anuncioId) {
        const weeks = pagamento.anuncioId.weeks || 1;
        await Anuncio.findByIdAndUpdate(pagamento.anuncioId, {
          status: 'active',
          dataAtivacao: new Date(),
          dataExpiracao: new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000)
        });
        console.log(`[WEBHOOK] ANÚNCIO ATIVADO! Ref: ${output_ThirdPartyReference}`);
      }

      console.log(`[WEBHOOK] PAGAMENTO APROVADO → ${output_ThirdPartyReference}`);
    } else {
      pagamento.status = 'falhou';
      await pagamento.save();
      console.log(`[WEBHOOK] PAGAMENTO REJEITADO → ${output_ThirdPartyReference}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[WEBHOOK] Erro interno:', err.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;