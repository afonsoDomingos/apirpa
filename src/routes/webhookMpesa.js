// src/routes/webhookMpesa.js
const express = require('express');
const router = express.Router();
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');
const Talento = require('../models/Talento');
const Usuario = require('../models/usuarioModel');
const webhookNotifier = require('../services/webhookNotifier');

router.post('/mpesa', async (req, res) => {
  console.log('[WEBHOOK MPESA] Recebido:', JSON.stringify(req.body, null, 2));

  const {
    output_ThirdPartyReference,
    output_ResponseCode,
    output_ConversationID,
    output_TransactionStatus
  } = req.body;

  if (!output_ThirdPartyReference) {
    return res.json({ success: true });
  }

  try {
    // ====== 1. ANÚNCIOS (o teu código original) ======
    const pagamento = await Pagamento.findOne({
      'gatewayResponse.reference': output_ThirdPartyReference
    }).populate('anuncioId').populate('usuarioId');

    if (pagamento) {
      if (pagamento.status === 'aprovado' || pagamento.status === 'falhou') {
        return res.json({ success: true });
      }

      if (output_ResponseCode === '00' || output_TransactionStatus === 'Completed') {
        pagamento.status = 'aprovado';
        pagamento.dataPagamento = new Date();
        pagamento.gatewayResponse.transactionId = output_ConversationID;
        await pagamento.save();

        let anuncioNome = null;
        if (pagamento.anuncioId) {
          const weeks = pagamento.anuncioId.weeks || 1;
          await Anuncio.findByIdAndUpdate(pagamento.anuncioId, {
            status: 'active',
            dataAtivacao: new Date(),
            dataExpiracao: new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000)
          });
          anuncioNome = pagamento.anuncioId.name;
          console.log(`[WEBHOOK] ANÚNCIO ATIVADO → ${output_ThirdPartyReference}`);
        }

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
          referencia: pagamento.referencia,
          anuncioNome
        });

      } else {
        pagamento.status = 'falhou';
        await pagamento.save();
      }

      return res.json({ success: true });
    }

    // ====== 2. PAINEL DE TALENTOS (NOVO) ======
    if (output_ThirdPartyReference.startsWith('TAL')) {
      console.log('[WEBHOOK TALENTO] Recebido:', output_ThirdPartyReference);

      const talentoId = output_ThirdPartyReference.replace('TAL', '').substring(0, 24);

      const talento = await Talento.findById(talentoId);
      if (!talento) {
        console.log('[WEBHOOK TALENTO] Não encontrado:', talentoId);
        return res.json({ success: true });
      }

      if ((output_ResponseCode === '00' || output_TransactionStatus === 'Completed') && !talento.pago) {
        talento.pago = true;
        await talento.save();

        console.log(`[WEBHOOK TALENTO] ATIVADO → ${talento.nome} (ID: ${talentoId})`);

        // Notificação em tempo real
        const io = req.app.get('io');
        if (io) {
          io.to(talento.userId.toString()).emit('talento:ativado', {
            sucesso: true,
            mensagem: 'PARABÉNS! O teu perfil já está no Painel de Talentos por 24h!',
            views: talento.views
          });
        }
      }

      return res.json({ success: true });
    }

    // Se não for nada conhecido
    console.log('[WEBHOOK] Referência desconhecida:', output_ThirdPartyReference);
    return res.json({ success: true });

  } catch (err) {
    console.error('[WEBHOOK] Erro:', err.message);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;