require('dotenv').config();

const apiKey = process.env.MPESA_API_KEY;
const publicKey = process.env.MPESA_PUBLIC_KEY;
const resourceUrl = process.env.MPESA_RESOURCE_URL;

console.log(apiKey, publicKey, resourceUrl); // Apenas para garantir que as variáveis estão sendo carregadas corretamente


const express = require('express');
const app = express();
const cors = require('cors');
const connectDB = require('./config/db');
const Documento = require('./models/documentoModel');

// Importar rotas
const chatbotRoute = require('./routes/chatbot');
const documentoRoutes = require('./routes/documentoRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const solicitacoesRouter = require('./routes/solicitacoesRoutes');
const documentosGuardadosRoutes = require('./routes/documentosGuardadosRoutes.js');
const pagamentoRoutes = require("./routes/pagamentoRoutes");
const { mpesaCallbackHandler } = require("./controllers/mpesaCallbackController");

const port = process.env.PORT || 5000;

// ⚠️ Middleware JSON - deve vir ANTES de usar rotas com req.body
app.use(express.json());

// CORS
const allowedOrigins = ['https://recuperaaqui.vercel.app', 'http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE','OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Rota simples para testar
app.get('/', (req, res) => res.send('API rodando com sucesso!'));

// Rota API do Chatbot
app.use('/api/chatbot', chatbotRoute);

// Callback da M-Pesa (com corpo bruto)
app.post(
  "/api/pagamentos/mpesa/callback",
  express.raw({ type: "*/*" }),
  mpesaCallbackHandler
);

// Conectar ao MongoDB e iniciar servidor
connectDB()
  .then(() => {
    // Outras rotas
    app.use('/api', documentoRoutes); 
    app.use('/api/auth', authRoutes);
    app.use('/api', solicitacoesRouter);
    app.use('/api/documentosguardados', documentosGuardadosRoutes);
    app.use('/api/pagamentos', pagamentoRoutes);

    // Contador de documentos reportados
    app.get('/api/documentos/count', async (req, res) => {
      try {
        const count = await Documento.countDocuments({ origem: 'reportado' });
        res.json({ count });
      } catch (error) {
        console.error('Erro ao contar documentos', error);
        res.status(500).json({ message: 'Erro ao contar documentos' });
      }
    });

    // Iniciar servidor
    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });
  })
  .catch(err => {
    console.error('Erro ao conectar ao banco:', err);
  });
