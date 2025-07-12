require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const connectDB = require('./config/db');
const Documento = require('./models/documentoModel'); // importar modelo para contar documentos'

// importar rotas
const documentoRoutes = require('./routes/documentoRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const solicitacoesRouter = require('./routes/solicitacoesRoutes');
const documentosGuardadosRoutes = require('./routes/documentosGuardadosRoutes.js');
const pagamentoRoutes = require("./routes/pagamentoRoutes");
const { mpesaCallbackHandler } = require("./controllers/mpesaCallbackController");

const port = process.env.PORT || 5000;






// Callback da M-Pesa com corpo bruto (antes do express.json())
app.post(
  "/api/pagamentos/mpesa/callback",
  express.raw({ type: "*/*" }),
  mpesaCallbackHandler
);




// Middleware JSON para o restante da API
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

// Middleware JSON
app.use(express.json());

// Rota simples para testar
app.get('/', (req, res) => res.send('API rodando com sucesso!'));

// Conectar ao DB e depois iniciar servidor
connectDB()
  .then(() => {
    // Rotas
    app.use('/api', documentoRoutes); 
    app.use('/api/auth', authRoutes);
    app.use('/api', solicitacoesRouter);
    app.use('/api/documentosguardados', documentosGuardadosRoutes);
    app.use('/api/pagamentos', pagamentoRoutes);

    // Rota para contar documentos reportados
    app.get('/api/documentos/count', async (req, res) => {
      try {
        const count = await Documento.countDocuments({ origem: 'reportado' });
        res.json({ count });
      } catch (error) {
        console.error('Erro ao contar documentos', error);
        res.status(500).json({ message: 'Erro ao contar documentos' });
      }
    });

    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });
  })
  .catch(err => {
    console.error('Erro ao conectar ao banco:', err);
  });
