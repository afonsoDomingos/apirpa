require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Documento = require('./models/documentoModel');

// ==================== ROTAS QUE PRECISAM DE BODY RAW (WEBHOOKS) ====================
const stripeRoutes = require('./routes/stripeRoutes');   // Webhook do Stripe
const webhookMpesa = require('./routes/webhookMpesa');   // Webhook M-Pesa / Emola

// ==================== DEMAIS ROTAS NORMAIS ====================
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

// Meta CAPI
const { sendConversionEvent } = require('./services/metaConversions');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

/* ===============================
    VERIFICAÇÃO DAS VARIÁVEIS
=================================*/
console.log("\n════════════════════════════════");
console.log(" VERIFICAÇÃO DAS VARIÁVEIS");
console.log("════════════════════════════════\n");

console.log(`MPESA_API_KEY: ${process.env.MPESA_API_KEY ? "OK" : "NÃO CARREGADA"}`);
console.log(`MPESA_PUBLIC_KEY: ${process.env.MPESA_PUBLIC_KEY ? "OK" : "NÃO CARREGADA"}`);
console.log(`MPESA_C2B_URL: ${process.env.MPESA_C2B_URL ? "OK" : "NÃO CARREGADA"}`);
console.log("Meta CAPI inicializado.\n");

/* ===============================
   1. WEBHOOKS PRIMEIRO → ANTES DO express.json()!!!
=================================*/
app.use('/api/stripe', stripeRoutes);   // Stripe (raw body)
app.use('/webhook', webhookMpesa);    // M-Pesa

/* ===============================
   2. AGORA SIM O PARSER JSON (seguro)
=================================*/
app.use(express.json());

/* ===============================
                CORS
=================================*/
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
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});

io.on('connection', (socket) => {
  console.log(`Socket conectado: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket desconectado: ${socket.id}`));
});

app.set('io', io);

/* ===============================
    ROTA FACEBOOK CONVERSIONS API
=================================*/
app.post('/api/facebook/conversion', async (req, res) => {
  console.log("\nRecebendo evento do frontend para Meta CAPI...");

  try {
    const { event_name, eventData = {}, userData = {}, event_id } = req.body;

    if (!event_id) {
      console.log("ERRO: event_id não foi enviado!");
      return res.status(400).json({ error: 'event_id é obrigatório' });
    }

    console.log(`Enviando evento para Meta: ${event_name} | ID: ${event_id}`);

    await sendConversionEvent(event_name, {
      ...eventData,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    }, userData, event_id);

    console.log("Evento CAPI enviado com sucesso!");
    res.json({ success: true });
  } catch (error) {
    console.error("ERRO NA ROTA CAPI:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
           ROTAS NORMAIS
=================================*/
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

// Rota normal do Stripe (create-payment-intent)
app.use('/api/stripe', stripeRoutes);

app.use('/uploads', express.static('uploads'));

/* ===============================
   CONTADOR DE DOCUMENTOS
=================================*/
app.get('/api/documentos/count', async (req, res) => {
  try {
    const count = await Documento.countDocuments({ origem: 'reportado' });
    res.json({ count });
  } catch (error) {
    console.error("Erro ao contar documentos:", error);
    res.status(500).json({ message: 'Erro ao contar documentos' });
  }
});

/* ===============================
          HEALTH CHECK
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
       INICIAR SERVIDOR
=================================*/
connectDB()
  .then(() => {
    console.log("MongoDB conectado com sucesso!");
    server.listen(port, () => {
      console.log("\n════════════════════════════════════");
      console.log(" SERVIDOR RODANDO COM SUCESSO");
      console.log("════════════════════════════════════");
      console.log(`Servidor rodando na porta ${port}`);
      console.log("Socket.IO ativo");
      console.log("Webhook Stripe → POST /api/stripe");
      console.log("Webhook M-Pesa → POST /webhook/mpesa");
      console.log("CAPI: POST /api/facebook/conversion");
      console.log("🟢API pronta para receber requisições");
      console.log("════════════════════════════════════\n");
    });
  })
  .catch(err => {
    console.error("ERRO AO CONECTAR NO MONGO:", err);
    process.exit(1);
  });