// routes/stripeRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// VALORES
const TAXA_MZN_PARA_USD = 63.5;
const MINIMO_USD_CENTS = 50; // 50 centavos USD = ~32 MZN

// CRIAR PAYMENT INTENT
router.post('/create-payment-intent', verificarToken, async (req, res) => {
  try {
    const { amount, pacote, type } = req.body;

    if (!amount || !pacote || !type) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios faltando' });
    }

    const valorMzn = parseInt(amount, 10);
    if (isNaN(valorMzn) || valorMzn <= 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido' });
    }

    // Bloqueia valores muito baixos (Stripe não aceita < 50 centavos USD)
    if (valorMzn < 32) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Valor muito baixo para cartão. Escolha o plano Mensal ou Anual.'
      });
    }

    const amountUsdCents = Math.round((valorMzn / TAXA_MZN_PARA_USD) * 100);

    if (amountUsdCents < MINIMO_USD_CENTS) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Valor mínimo para cartão: ~32 MZN'
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountUsdCents,
      currency: 'usd',
      payment_method_types: ['card'],
      automatic_payment_methods: { enabled: true },
      metadata: {
        usuarioId: req.usuario.id,
        pacote: pacote.toLowerCase(),
        type,
        amount_mzn: valorMzn.toString(),
      },
    });

    res.json({
      sucesso: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (err) {
    console.error('ERRO STRIPE:', err.message);
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao processar cartão'
    });
  }
});

// WEBHOOK (não precisa mudar)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { usuarioId, pacote, amount_mzn } = pi.metadata;

    console.log(`PAGAMENTO APROVADO! User: ${usuarioId} | ${amount_mzn} MZN | ${pacote}`);

    try {
      const Pagamento = require('../models/pagamentoModel');
      const User = require('../models/userModel');

      await new Pagamento({
        usuarioId,
        pacote: pacote || 'mensal',
        metodoPagamento: 'card',
        valor: parseInt(amount_mzn),
        status: 'aprovado',
        tipoPagamento: 'assinatura',
        referencia: pi.id,
        gatewayResponse: { paymentIntent: pi.id },
        dataPagamento: new Date(),
      }).save();

      const dias = pacote === 'anual' ? 365 : 30;
      await User.findByIdAndUpdate(usuarioId, {
        premium: true,
        plano: pacote,
        dataExpiracao: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
      });

      console.log(`Usuário ${usuarioId} agora é PREMIUM!`);
    } catch (err) {
      console.error('Erro ao ativar premium:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;