require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Documento = require('./models/documentoModel');

// Rotas
const chatbotRoutes = require('./routes/chatbot');
const documentoRoutes = require('./routes/documentoRoutes');
const authRoutes = require('./routes/authRoutes');
const solicitacoesRouter = require('./routes/solicitacoesRoutes');
const documentosGuardadosRoutes = require('./routes/documentosGuardadosRoutes');
const pagamentoRoutes = require('./routes/pagamentoRoutes');
const noticiasRouter = require('./routes/noticias');
const postsRoutes = require('./routes/postsRoutes');
const emolaCallbackRoutes = require('./routes/emolaCallback');
const emolaTestRouter = require('./routes/emolaTest');
const anunciosRouter = require('./routes/anuncios');
const pushRoutes = require('./routes/pushRoutes');
const { notificarAdmin } = require('./services/notificationService');



const webhookMpesa = require('./routes/webhookMpesa');

// Meta CAPI
const { sendConversionEvent } = require('./services/metaConversions');


// Depois de todas as rotas existentes
const stripeRoutes = require('./routes/stripeRoutes');


const app = express();
const port = process.env.PORT || 5000;

/* ===============================
    VARIÁVEIS DE AMBIENTE
=================================*/
console.log("\n===============================");
console.log("🔧 VERIFICAÇÃO DAS VARIÁVEIS");
console.log("===============================\n");

console.log(`➡️ MPESA_API_KEY: ${process.env.MPESA_API_KEY ? "✔ OK" : "❌ NÃO CARREGADA"}`);
console.log(`➡️ MPESA_PUBLIC_KEY: ${process.env.MPESA_PUBLIC_KEY ? "✔ OK" : "❌ NÃO CARREGADA"}`);
console.log(`➡️ MPESA_C2B_URL: ${process.env.MPESA_C2B_URL ? "✔ OK" : "❌ NÃO CARREGADA"}`);
console.log("🔵 Meta CAPI inicializado.\n");

/* ===============================
             MIDDLEWARES
=================================*/

// ⚠️ CRÍTICO: Webhook do Stripe DEVE vir ANTES de qualquer body parser
// A rota precisa do body RAW (Buffer) para validar a assinatura criptográfica
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const webhookNotifier = require('./services/webhookNotifier');

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log(' WEBHOOK STRIPE RECEBIDO');
  console.log('════════════════════════════════════════════════');
  console.log('Timestamp:', new Date().toLocaleString('pt-MZ'));
  console.log('Signature:', sig ? 'presente' : 'AUSENTE!');
  console.log('Body type:', typeof req.body, '| isBuffer:', Buffer.isBuffer(req.body));
  console.log('────────────────────────────────────────────────');

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('✓ Webhook verificado com sucesso!');
    console.log('Event ID:', event.id);
    console.log('Event Type:', event.type);

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const metadata = pi.metadata;

      console.log(' PAYMENT_INTENT.SUCCEEDED');
      console.log('   PaymentIntent ID:', pi.id);
      console.log('   Amount:', pi.amount, '(', pi.currency.toUpperCase(), ')');
      console.log('   Metadata:', metadata);

      const { usuarioId, pacote, type, amount_mzn, anuncioId, weeks } = metadata;

      if (!usuarioId) {
        console.error('ERRO: usuarioId não encontrado na metadata!');
        return res.json({ received: true });
      }

      try {
        const Pagamento = require('./models/pagamentoModel');
        const Anuncio = require('./models/Anuncio');
        const Usuario = require('./models/usuarioModel');

        const pagamento = new Pagamento({
          usuarioId,
          pacote: pacote || (type === 'anuncio' ? 'anuncio' : 'mensal'),
          metodoPagamento: 'card',
          valor: parseInt(amount_mzn) || pi.amount,
          telefone: null,
          status: 'aprovado',
          tipoPagamento: type || 'assinatura',
          dataPagamento: new Date(),
          gatewayResponse: { paymentIntent: pi.id, stripeEvent: event.id },
          referencia: pi.id,
        });

        await pagamento.save();
        console.log('✅ Pagamento salvo no banco! ID:', pagamento._id);

        let anuncioNome = null;
        if (type === 'anuncio' && anuncioId) {
          const weeksNum = parseInt(weeks) || 1;
          const expiracao = new Date(Date.now() + weeksNum * 7 * 24 * 60 * 60 * 1000);

          const anuncio = await Anuncio.findByIdAndUpdate(anuncioId, {
            status: 'active',
            dataAtivacao: new Date(),
            dataExpiracao: expiracao,
          }, { new: true });

          anuncioNome = anuncio?.name;
          console.log(`✅ Anúncio ${anuncioId} ativado por ${weeksNum} semana(s)`);
        }

        // 🔔 ENVIAR NOTIFICAÇÕES WEBHOOK
        const usuario = await Usuario.findById(usuarioId);
        await webhookNotifier.sendWebhookNotification(usuarioId, 'payment.approved', {
          pagamentoId: pagamento._id.toString(),
          usuarioNome: usuario?.nome,
          usuarioEmail: usuario?.email,
          valor: pagamento.valor,
          pacote: pagamento.pacote,
          metodoPagamento: pagamento.metodoPagamento,
          tipoPagamento: pagamento.tipoPagamento,
          dataPagamento: pagamento.dataPagamento,
          referencia: pagamento.referencia,
          anuncioNome
        });

        // 🔔 NOTIFICAÇÃO PUSH PARA ADMIN
        await notificarAdmin({
          title: 'Novo Pagamento Recebido! 💰',
          body: `${usuario?.nome || 'Um usuário'} acabou de pagar ${pagamento.valor} MZN via Cartão.`,
          icon: '/icon.png', // Ajustar para o ícone real do app
          data: {
            url: '/admin/pagamentos',
            pagamentoId: pagamento._id
          }
        });

      } catch (error) {
        console.error('❌ ERRO ao salvar no banco:', error.message);
      }
    }

  } catch (err) {
    console.error('❌ Webhook signature verification FAILED!');
    console.error('Erro:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('════════════════════════════════════════════════\n');
  res.json({ received: true });
});

app.use(express.json());

/* ===============================
                CORS
=================================*/
console.log("🌐 Configurando CORS...");

const allowedOrigins = [
  'https://recuperaaqui.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      console.log(`🟢 CORS permitido: ${origin || "sem origem (mobile/postman)"}`);
      callback(null, true);
    } else {
      console.log(`⛔ CORS BLOQUEADO: ${origin}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

/* ===============================
             SOCKET.IO
=================================*/
console.log("🔌 Iniciando Socket.IO...");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  console.log(`🟢 Socket conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔴 Socket desconectado: ${socket.id}`);
  });
});

app.set('io', io);
global.io = io; // Disponibilizar io globalmente para webhookNotifier

/* ===============================
    ROTA: FACEBOOK CONVERSIONS API
=================================*/
app.post('/api/facebook/conversion', async (req, res) => {
  console.log("\n📩 Recebendo evento do frontend para CAPI...");

  try {
    const { event_name, eventData = {}, userData = {}, event_id } = req.body;

    if (!event_id) {
      console.log("⚠️ ERRO: event_id não foi enviado!");
      return res.status(400).json({ error: 'event_id é obrigatório' });
    }

    console.log(`📤 Enviando evento para Meta: ${event_name} | ID: ${event_id}`);

    await sendConversionEvent(
      event_name,
      {
        ...eventData,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      },
      userData,
      event_id
    );

    console.log("✅ Evento CAPI enviado com sucesso!");
    res.json({ success: true });
  } catch (error) {
    console.error("❌ ERRO NA ROTA CAPI:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
                ROTAS
=================================*/
console.log("\n🛣️ Registrando rotas da API...");

// ⚠️ IMPORTANTE: Stripe webhook PRECISA vir ANTES do express.json()
// para receber o body em formato RAW (necessário para validar assinatura)
app.use('/api/stripe', stripeRoutes);
app.use('/api/webhooks', require('./routes/webhookRoutes'));

app.use(express.urlencoded({ extended: true, limit: '10mb' })); // ← ESSA LINHA É OBRIGATÓRIA
app.use(express.json({ limit: '10mb' })); // ← ESSA LINHA É OBRIGATÓRIA
app.get('/', (req, res) => res.send('API rodando com sucesso!'));

app.use('/api/chatbot', chatbotRoutes);
app.use('/api', documentoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', solicitacoesRouter);
app.use('/api/documentosguardados', documentosGuardadosRoutes);
app.use('/api/pagamentos', pagamentoRoutes);
app.use('/api/noticias', noticiasRouter);
app.use('/api/posts', postsRoutes);
app.use('/api/emola', emolaCallbackRoutes);
app.use('/api/emola/test', emolaTestRouter);
app.use('/api/anuncios', anunciosRouter);
app.use('/api/push', pushRoutes);

app.use('/uploads', express.static('uploads'));


app.use('/webhook', webhookMpesa);  // ← URL que você vai colocar no portal da Vodacom

app.use('/api/talentos', require('./routes/talentosRoutes'));


/* ===============================
   CONTADOR DE DOCUMENTOS
=================================*/
app.get('/api/documentos/count', async (req, res) => {
  console.log("📊 Contando documentos com origem 'reportado'...");
  try {
    const count = await Documento.countDocuments({ origem: 'reportado' });
    res.json({ count });
  } catch (error) {
    console.error("❌ Erro ao contar documentos:", error);
    res.status(500).json({ message: 'Erro ao contar documentos' });
  }
});


// ===== ROTA PARA ACORDAR O RENDER (OBRIGATÓRIO NO FREE PLAN) =====
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API RPA Live rodando perfeitamente!',
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* ===============================
   INICIAR API + MONGO
=================================*/
console.log("\n🔗 Conectando ao MongoDB...");

connectDB()
  .then(() => {
    console.log("✅ MongoDB conectado com sucesso!");
    server.listen(port, () => {
      console.log("\n====================================");
      console.log(`🚀 Servidor rodando na porta ${port}`);
      console.log("📡 Socket.IO ativo");
      console.log("📍 CAPI: POST /api/facebook/conversion");
      console.log("🟢 API pronta para receber requisições");
      console.log("====================================\n");
    });
  })
  .catch(err => {
    console.error("❌ ERRO AO CONECTAR NO MONGO:", err);
    process.exit(1);
  });