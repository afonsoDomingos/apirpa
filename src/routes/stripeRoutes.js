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

  // LOG 1: Recebimento do webhook
  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log(' WEBHOOK STRIPE RECEBIDO');
  console.log('════════════════════════════════════════════════');
  console.log('Timestamp:', new Date().toLocaleString('pt-MZ'));
  console.log('Event Type (raw):', req.headers['stripe-event-type'] || 'não informado');
  console.log('Signature:', sig ? 'presente' : 'AUSENTE!');
  console.log('Body (primeiros 500 chars):');
  console.log(req.body.toString('utf8').substring(0, 500));
  console.log('────────────────────────────────────────────────');

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // LOG 2: Evento construído com sucesso
    console.log('✓ Webhook verificado com sucesso!');
    console.log('Event ID:', event.id);
    console.log('Event Type:', event.type);
    console.log('Created:', new Date(event.created * 1000).toLocaleString('pt-MZ'));

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const metadata = pi.metadata;

      console.log(' PAYMENT_INTENT.SUCCEEDED');
      console.log('   PaymentIntent ID:', pi.id);
      console.log('   Amount:', pi.amount, '(', pi.currency.toUpperCase(), ')');
      console.log('   Amount MZN (metadata):', metadata.amount_mzn);
      console.log('   Metadata completa:');
      console.table(metadata);

      const { usuarioId, pacote, type, amount_mzn } = metadata;

      if (!usuarioId) {
        console.error('ERRO: usuarioId não encontrado na metadata!');
        return res.json({ received: true });
      }

      try {
        const Pagamento = require('../models/pagamentoModel');
        const Anuncio = require('../models/Anuncio');

        const pagamento = new Pagamento({
          usuarioId,
          pacote: pacote || 'cartao',
          metodoPagamento: 'card',
          valor: parseInt(amount_mzn) || pi.amount,
          telefone: null,
          status: 'aprovado',
          tipoPagamento: type || 'pacote',
          dataPagamento: new Date(),
          gatewayResponse: { paymentIntent: pi.id, stripeEvent: event.id },
          referencia: pi.id,
        });

        await pagamento.save();
        console.log('Pagamento salvo no banco com sucesso! ID:', pagamento._id);

        // Se for anúncio
        if (type === 'anuncio' && metadata.anuncioId) {
          const weeks = parseInt(metadata.weeks) || 1;
          const expiracao = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);

          await Anuncio.findByIdAndUpdate(metadata.anuncioId, {
            status: 'active',
            dataAtivacao: new Date(),
            dataExpiracao: expiracao,
          });

          console.log(`Anúncio ${metadata.anuncioId} ativado por ${weeks} semana(s)`);
          console.log(`Expira em: ${expiracao.toLocaleString('pt-MZ')}`);
        } else if (type !== 'anuncio') {
          console.log(`Pagamento de pacote para usuário ${usuarioId} processado com sucesso`);
        }

      } catch (error) {
        console.error('ERRO ao processar pagamento no banco:', error.message);
        console.error(error.stack);
      }
    } else {
      console.log(`Evento ${event.type} recebido, mas não tratado neste webhook.`);
    }

  } catch (err) {
    console.error('Webhook signature verification FAILED!');
    console.error('Erro:', err.message);
    console.error('Stack:', err.stack);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Webhook processado com sucesso - respondendo 200');
  console.log('════════════════════════════════════════════════\n');

  res.json({ received: true });
});

module.exports = router;