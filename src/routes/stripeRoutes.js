// routes/stripeRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ================================================================
// 1. CRIAR PAYMENT INTENT → Usado pelo Payment Element (fica no site)
// ================================================================
router.post('/create-payment-intent', verificarToken, async (req, res) => {
  console.log('CREATE PAYMENT INTENT solicitado por:', req.usuario.id);

  try {
    const { amount_mzn, pacote = 'cartao', type = 'assinatura', anuncioId, weeks } = req.body;

    if (!amount_mzn || !pacote) {
      console.log('Dados incompletos no create-payment-intent');
      return res.status(400).json({ sucesso: false, mensagem: 'Valor e pacote são obrigatórios' });
    }

    const amountUsdCents = Math.round((parseInt(amount_mzn) / 63.5) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountUsdCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        usuarioId: req.usuario.id,
        pacote,
        type,
        amount_mzn: amount_mzn.toString(),
        anuncioId: anuncioId || '',
        weeks: weeks || '',
      },
    });

    console.log('PaymentIntent criado com sucesso:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('ERRO AO CRIAR PAYMENT INTENT:', err.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor Stripe' });
  }
});

// ================================================================
// 2. WEBHOOK DO STRIPE → Fica aqui! (organizado e 100% funcional)
// ================================================================
router.post(
  '/webhook',
  // Importante: express.raw() só nesta rota → não interfere nas outras
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log('\nWEBHOOK STRIPE CHAMADO!');
    console.log('Signature presente:', !!sig);
    console.log('Tamanho do body bruto:', req.body.length, 'bytes');

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log('ASSINATURA VERIFICADA COM SUCESSO!');
      console.log('Evento recebido:', event.type);
    } catch (err) {
      console.error('FALHA NA VERIFICAÇÃO DA ASSINATURA:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // EVENTO PRINCIPAL: pagamento com cartão aprovado
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;

      console.log('PAGAMENTO COM CARTÃO APROVADO!');
      console.log('PaymentIntent ID:', pi.id);
      console.log('Metadata:', pi.metadata);

      const { usuarioId, pacote, type, amount_mzn, anuncioId, weeks } = pi.metadata;

      try {
        const Pagamento = require('../models/pagamentoModel');
        const Anuncio = require('../models/Anuncio');

        // Salvar pagamento no banco
        const novoPagamento = new Pagamento({
          usuarioId,
          pacote: pacote || 'cartao',
          metodoPagamento: 'card',
          valor: parseInt(amount_mzn),
          telefone: null,
          status: 'aprovado',
          tipoPagamento: type || 'assinatura',
          dataPagamento: new Date(),
          gatewayResponse: { paymentIntent: pi.id },
          referencia: pi.id,
          anuncioId: anuncioId || null,
        });

        await novoPagamento.save();
        console.log('PAGAMENTO COM CARTÃO SALVO NO BANCO! ID:', novoPagamento._id);

        // Ativar anúncio se for pagamento de anúncio
        if (type === 'anuncio' && anuncioId) {
          const expiracao = new Date(Date.now() + (parseInt(weeks || 1) * 7 * 24 * 60 * 60 * 1000));
          await Anuncio.findByIdAndUpdate(anuncioId, {
            status: 'active',
            dataAtivacao: new Date(),
            dataExpiracao: expiracao,
          });
          console.log('ANÚNCIO ATIVADO!', { anuncioId, semanas: weeks });
        }

      } catch (err) {
        console.error('ERRO AO SALVAR PAGAMENTO NO BANCO:', err.message);
      }
    }

    // Outros eventos (opcional – só para debug)
    else if (event.type === 'payment_intent.payment_failed') {
      console.log('PAGAMENTO FALHOU:', event.data.object.last_payment_error?.message);
    }

    // Sempre responde rápido
    res.json({ received: true });
  }
);

module.exports = router;