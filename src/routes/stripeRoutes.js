// routes/stripeRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


// ===============================
// 1. CRIAR PAYMENT INTENT
// ===============================
router.post('/create-payment-intent', verificarToken, async (req, res) => {
  try {
    const { amount, pacote, type } = req.body;

    if (!amount || !pacote || !type) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos' });
    }

    // Conversão MZN → USD
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


// ===============================
// 2. WEBHOOK STRIPE
// ===============================
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {

    console.log("\n==============================");
    console.log("📡  WEBHOOK RECEBIDO DO STRIPE");
    console.log("==============================");

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("❌ ERRO DE ASSINATURA DO WEBHOOK:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 👉 Loga o tipo de evento
    console.log("📨 Evento recebido:", event.type);

    if (event.type === 'payment_intent.succeeded') {

      console.log("✅ Payment Intent Aprovado!");

      const pi = event.data.object;
      console.log("🔍 METADATA RECEBIDA:", pi.metadata);

      const { usuarioId, pacote, type, amount_mzn } = pi.metadata;

      const Pagamento = require('../models/pagamentoModel');
      const Anuncio = require('../models/Anuncio');

      try {
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
        console.log("💾 Pagamento guardado com sucesso no MongoDB!");

        // Lógica para anúncios
        if (type === 'anuncio' && pi.metadata.anuncioId) {
          await Anuncio.findByIdAndUpdate(pi.metadata.anuncioId, {
            status: 'active',
            dataAtivacao: new Date(),
            dataExpiracao: new Date(Date.now() + (pi.metadata.weeks * 7 * 24 * 60 * 60 * 1000)),
          });

          console.log("📢 Anúncio ativado com sucesso!");
        }

      } catch (err) {
        console.log("❌ ERRO AO GUARDAR NO BANCO:", err);
      }
    }

    res.json({ received: true });
  }
);


module.exports = router;
