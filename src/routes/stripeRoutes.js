// routes/stripeRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 1. Criar PaymentIntent (chamado pelo frontend)
router.post('/create-payment-intent', verificarToken, async (req, res) => {
  try {
    const { amount, pacote, type } = req.body;

    if (!amount || !pacote || !type) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos.' });
    }

    // Converter MZN → USD (taxa realista 2025)
    const USD_RATE = 63.5;
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

// 2. Webhook Stripe — VERSÃO FINAL E SEGURA (2025)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log(`Webhook recebido: ${event.type}`);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { usuarioId, pacote, amount_mzn } = pi.metadata;

    console.log(`Pagamento com cartão aprovado! User: ${usuarioId} | Plano: ${pacote} | MZN ${amount_mzn}`);

    try {
      const Pagamento = require('../models/pagamentoModel');

      const novoPagamento = new Pagamento({
        usuarioId,
        pacote: pacote || 'mensal',
        metodoPagamento: 'card',
        valor: parseInt(amount_mzn),
        telefone: null,
        status: 'aprovado',
        tipoPagamento: 'assinatura',
        dataPagamento: new Date(),
        gatewayResponse: { paymentIntent: pi.id },
        referencia: pi.id,
      });
      await novoPagamento.save();

      // Ativa o premium do usuário
      const User = require('../models/userModel');
      await User.findByIdAndUpdate(usuarioId, {
        premium: true,
        plano: pacote,
        dataExpiracao: pacote === 'anual' 
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      console.log(`Usuário ${usuarioId} agora é PREMIUM!`);
    } catch (err) {
      console.error('Erro ao salvar pagamento ou ativar premium:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;