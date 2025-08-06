require('dotenv').config(); // Carrega variáveis do .env no process.env

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db'); // Conexão MongoDB
const Documento = require('./models/documentoModel');

// Importação dos routers
const chatbotRoute = require('./routes/chatbot');
const documentoRoutes = require('./routes/documentoRoutes');
const authRoutes = require('./routes/authRoutes');
const solicitacoesRouter = require('./routes/solicitacoesRoutes');
const documentosGuardadosRoutes = require('./routes/documentosGuardadosRoutes');
const pagamentoRoutes = require('./routes/pagamentoRoutes');
const { mpesaCallbackHandler } = require('./controllers/mpesaCallbackController');

const app = express();
const port = process.env.PORT || 5000;

// Variáveis ambiente para M-Pesa
const apiKey = process.env.MPESA_API_KEY;
const publicKey = process.env.MPESA_PUBLIC_KEY?.replace(/\\n/g, '\n');
const mpesaC2bUrl = process.env.MPESA_C2B_URL;

console.log("Variáveis de ambiente carregadas:");
console.log(`API Key: ${apiKey ? 'Carregada' : 'NÃO CARREGADA'}`);
console.log(`Public Key: ${publicKey ? 'Carregada' : 'NÃO CARREGADA'}`);
console.log(`M-Pesa C2B URL: ${mpesaC2bUrl ? 'Carregada' : 'NÃO CARREGADA'}`);

// Middlewares
app.use(express.json());

// Configuração CORS - ajuste conforme seu front
const allowedOrigins = ['https://recuperaaqui.vercel.app', 'http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Requisições sem origin (Postman, curl)
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Rota raiz para teste simples
app.get('/', (req, res) => res.send('API rodando com sucesso!'));

// Rotas organizadas para evitar conflito e 404
app.use('/api/chatbot', chatbotRoute);
app.use('/api/documentos', documentoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/solicitacoes', solicitacoesRouter);
app.use('/api/documentosguardados', documentosGuardadosRoutes);
app.use('/api/pagamentos', pagamentoRoutes);

// Rota de callback da M-Pesa (usando express.raw para corpo em buffer)
app.post(
  "/api/pagamentos/mpesa/callback",
  express.raw({ type: "*/*" }),
  mpesaCallbackHandler
);

// Endpoint para contar documentos reportados
app.get('/api/documentos/count', async (req, res) => {
  try {
    const count = await Documento.countDocuments({ origem: 'reportado' });
    res.json({ count });
  } catch (error) {
    console.error('Erro ao contar documentos', error);
    res.status(500).json({ message: 'Erro ao contar documentos' });
  }
});

// Conectar ao banco e iniciar o servidor
connectDB()
  .then(() => {
    console.log('Conectado ao MongoDB com sucesso!');
    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
      console.log(`Aguardando requisições...`);
    });
  })
  .catch(err => {
    console.error('Erro ao conectar ao banco de dados:', err);
    process.exit(1);
  });
