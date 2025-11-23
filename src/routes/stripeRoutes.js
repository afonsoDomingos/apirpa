// routes/stripeRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 1. Criar PaymentIntent (chamado pelo frontend)
router.post('/create-payment-intent', verificarToken, async (req, res) => {
  try {
    const { amount, pacote, type } = req.body; // amount em MZN (centavos virão depois)

    if (!amount || !pacote || !type) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos' });
    }

    // Converter MZN → USD (taxa fixa realista 2025)
    const USD_RATE = 63.5; // 1 USD ≈ 63.5 MZN (atualizado Nov/2025)
    const amountUsdCents = Math.round((amount / USD_RATE) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountUsdCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        usuarioId: req.usuario.id,
        pacote,
        type,
        amount_mzn: amount,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('Erro Stripe:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar pagamento' });
  }
});

// 2. Webhook Stripe (OBRIGATÓRIO para confirmar pagamento real)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { usuarioId, pacote, type, amount_mzn } = pi.metadata;

    // === AQUI REPLICAS A MESMA LÓGICA DO PAGAMENTO SUCESSO DO M-PESA ===
    const Pagamento = require('../models/pagamentoModel');
    const Anuncio = require('../models/Anuncio');

    const pagamento = new Pagamento({
      usuarioId,
      pacote: pacote || 'cartao',
      metodoPagamento: 'card',
      valor: parseInt(amount_mzn),
      telefone: null,
      status: 'aprovado',
      tipoPagamento: type,
      dataPagamento: new Date(),
      gatewayResponse: { paymentIntent: pi.id },
      referencia: pi.id,
    });
    await pagamento.save();

    // Se for anúncio
    if (type === 'anuncio' && pi.metadata.anuncioId) {
      await Anuncio.findByIdAndUpdate(pi.metadata.anuncioId, {
        status: 'active',
        dataAtivacao: new Date(),
        dataExpiracao: new Date(Date.now() + (pi.metadata.weeks * 7 * 24 * 60 * 60 * 1000)),
      });
    }
  }

  res.json({ received: true });
});

module.exports = router;