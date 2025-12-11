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

// NOTA: O webhook foi movido para server.js (antes dos middlewares)
// para garantir acesso ao body RAW necessário para validação de assinatura

module.exports = router;