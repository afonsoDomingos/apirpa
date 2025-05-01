require('dotenv').config(); // Carregar variáveis de ambiente

console.log('MONGO_URI:', process.env.MONGO_URI); // Verifica se a variável está sendo carregada

const connectDB = require('./config/db');
const express = require('express');
const cors = require('cors');
const documentoRoutes = require('./routes/documentoRoutes.js');
const authRoutes = require('./routes/authRoutes.js');

const app = express();
const port = process.env.PORT || 5000;

// CORS Configuração
app.use(cors({
  origin: 'https://recuperaaqui.vercel.app', // A origem do frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

connectDB(); // Conectar ao MongoDB

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
