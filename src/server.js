require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Documento = require('./models/documentoModel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Certifica-te que tens esta env

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
const webhookMpesa = require('./routes/webhookMpesa');
const stripeRoutes = require('./routes/stripeRoutes');

// Meta CAPI
const { sendConversionEvent } = require('./services/metaConversions');

const app = express();
const port = process.env.PORT || 5000;

/* ===============================
    VERIFICAÇÃO DAS VARIÁVEIS
=================================*/
console.log("\n===============================");
console.log("VERIFICAÇÃO DAS VARIÁVEIS");
console.log("===============================\n");

console.log(`MPESA_API_KEY: ${process.env.MPESA_API_KEY ? "OK" : "NÃO CARREGADA"}`);
console.log(`MPESA_PUBLIC_KEY: ${process.env.MPESA_PUBLIC_KEY ? "OK" : "NÃO CARREGADA"}`);
console.log(`MPESA_C2B_URL: ${process.env.MPESA_C2B_URL ? "OK" : "NÃO CARREGADA"}`);
console.log(`STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? "OK" : "FALTANDO!"}`);
console.log("Meta CAPI inicializado.\n");

/* ===============================
           MIDDLEWARES GLOBAIS
=================================*/
// ATENÇÃO: express.json() vem ANTES do webhook, mas NÃO afeta o webhook porque vamos usar raw body lá
app.use(express.json({ limit: '10mb' })); // continua funcionando para todas as outras rotas

/* ===============================
                CORS
=================================*/
console.log("Configurando CORS...");

const allowedOrigins = [
  'https://recuperaaqui.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      console.log(`CORS permitido: ${origin || "sem origem (mobile/postman)"}`);
      callback(null, true);
    } else {
      console.log(`CORS BLOQUEADO: ${origin}`);
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
console.log("Iniciando Socket.IO...");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket desconectado: ${socket.id}`);
  });
});

app.set('io', io);

/* ===============================
     WEBHOOK STRIPE (RAW BODY!)
=================================*/
// Esta rota TEM que vir ANTES de express.json() interferir no body
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('\nWEBHOOK STRIPE CHAMADO!');
  console.log('Headers stripe-signature:', sig ? 'Presente' : 'Ausente');
  console.log('Tamanho do body bruto:', req.body.length);

  let event;

  try {
    if (!sig || !webhookSecret) {
      console.log('Erro: Stripe signature ou secret ausente');
      return res.status(400).send('Webhook Error: config error');
    }

    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`Evento Stripe recebido: ${event.type}`);
  } catch (err) {
    console.log(`Erro no webhook Stripe: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Aqui colocas a tua lógica de tratamento de eventos
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('Pagamento concluído com sucesso!', event.data.object);
      // Exemplo: atualizar usuário para premium, enviar email, etc.
      break;
    case 'payment_intent.succeeded':
      console.log('PaymentIntent succeeded:', event.data.object.id);
      break;
    case 'payment_intent.payment_failed':
      console.log('Pagamento falhou:', event.data.object.last_payment_error?.message);
      break;
    default:
      console.log(`Evento não tratado: ${event.type}`);
  }

  res.json({ received: true });
});

/* ===============================
   ROTA: FACEBOOK CONVERSIONS API
=================================*/
app.post('/api/facebook/conversion', async (req, res) => {
  console.log("\nRecebendo evento do frontend para CAPI...");

  try {
    const { event_name, eventData = {}, userData = {}, event_id } = req.body;

    if (!event_id) {
      console.log("ERRO: event_id não foi enviado!");
      return res.status(400).json({ error: 'event_id é obrigatório' });
    }

    console.log(`Enviando evento para Meta: ${event_name} | ID: ${event_id}`);

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

    console.log("Evento CAPI enviado com sucesso!");
    res.json({ success: true });
  } catch (error) {
    console.error("ERRO NA ROTA CAPI:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
              ROTAS
=================================*/
console.log("\nRegistrando rotas da API...");

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
app.use('/api/stripe', stripeRoutes); // tuas rotas de create-checkout-session, etc.

app.use('/uploads', express.static('uploads'));
app.use('/webhook', webhookMpesa); // M-Pesa webhook

/* ===============================
     CONTADOR DE DOCUMENTOS
=================================*/
app.get('/api/documentos/count', async (req, res) => {
  console.log("Contando documentos com origem 'reportado'...");
  try {
    const count = await Documento.countDocuments({ origem: 'reportado' });
    res.json({ count });
  } catch (error) {
    console.error("Erro ao contar documentos:", error);
    res.status(500).json({ message: 'Erro ao contar documentos' });
  }
});

/* ===============================
17 ROTA HEALTH (Render)
=================================*/
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API RPA Live rodando perfeitamente!',
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* ===============================
     INICIAR SERVIDOR + MONGO
=================================*/
console.log("\nConectando ao MongoDB...");

connectDB()
  .then(() => {
    console.log("MongoDB conectado com sucesso!");
    server.listen(port, () => {
      console.log("\n====================================");
      console.log(`Servidor rodando na porta ${port}`);
      console.log("Socket.IO ativo");
      console.log("Stripe Webhook → POST /webhook/stripe");
      console.log("CAPI → POST /api/facebook/conversion");
      console.log("API pronta para receber requisições");
      console.log("====================================\n");
    });
  })
  .catch(err => {
    console.error("ERRO AO CONECTAR NO MONGO:", err);
    process.exit(1);
  });