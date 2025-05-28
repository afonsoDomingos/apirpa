require('dotenv').config(); // Carregar variáveis de ambiente

console.log('MONGO_URI:', process.env.MONGO_URI); // Verifica se a variável está sendo carregada

const connectDB = require('./config/db');
const express = require('express');
const cors = require('cors');
const documentoRoutes = require('./routes/documentoRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const solicitacoesRouter = require('./routes/solicitacoesRoutes');
const documentosGuardadosRoutes = require('./routes/documentosGuardadosRoutes.js');





const app = express();
const port = process.env.PORT || 5000;

// CORS Configuração
const allowedOrigins = [
  'https://recuperaaqui.vercel.app', // produção
  'http://localhost:3000'            // desenvolvimento local
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE'],
  credentials: true
}));


// Middleware para lidar com dados JSON
app.use(express.json());

// Rotas da API

app.get('/', (req, res) => {
  res.send('API rodando com sucesso!');
});
app.use('/api', documentoRoutes); 
app.use('/api/auth', authRoutes); // Usar o prefixo '/api/auth' para as rotas de autenticação
app.use('/api', solicitacoesRouter);
app.use('/api/documentosguardados', documentosGuardadosRoutes);

// Rota para contar documentos Achados
app.get('/api/documentos/count', (req, res) => {
  try {
    const count = documentos.filter(doc => doc.origem === 'reportado').length;
    res.json({ count });
  } catch (error) {
    console.error('Erro ao contar documentos', error);
    res.status(500).json({ message: 'Erro ao contar documentos' });
  }
});
connectDB(); // Conectar ao MongoDB

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
