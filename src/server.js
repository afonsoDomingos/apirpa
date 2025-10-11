require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Documento = require('./models/documentoModel');

// Importar rotas
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

const app = express();
const port = process.env.PORT || 5000;

// Variáveis de ambiente
const apiKey = process.env.MPESA_API_KEY;
const publicKey = process.env.MPESA_PUBLIC_KEY?.replace(/\\n/g, '\n');
const mpesaC2bUrl = process.env.MPESA_C2B_URL;

console.log("Variáveis de ambiente carregadas:");
console.log(`API Key: ${apiKey ? 'Carregada' : 'NÃO CARREGADA'}`);
console.log(`Public Key: ${publicKey ? 'Carregada' : 'NÃO CARREGADA'}`);
console.log(`M-Pesa C2B URL: ${mpesaC2bUrl ? 'Carregada' : 'NÃO CARREGADA'}`);

// Middlewares
app.use(express.json());

// CORS
const allowedOrigins = ['https://recuperaaqui.vercel.app', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Criar servidor HTTP e integrar Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Configuração do Socket.IO
io.on('connection', (socket) => {
  console.log('🟢 Novo cliente conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado:', socket.id);
  });
});

// Disponibilizar io para as rotas
app.set('io', io);

// Rotas principais
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
app.use('/uploads', express.static('uploads'));

// Contador de documentos
app.get('/api/documentos/count', async (req, res) => {
  try {
    const count = await Documento.countDocuments({ origem: 'reportado' });
    res.json({ count });
  } catch (error) {
    console.error('Erro ao contar documentos', error);
    res.status(500).json({ message: 'Erro ao contar documentos' });
  }
});

// Conectar ao MongoDB e iniciar servidor
connectDB()
  .then(() => {
    console.log('✅ Conectado ao MongoDB com sucesso!');
    server.listen(port, () => {
      console.log(`🚀 Servidor rodando na porta ${port}`);
      console.log('Aguardando requisições...');
    });
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ao banco de dados:', err);
    process.exit(1);
  });
