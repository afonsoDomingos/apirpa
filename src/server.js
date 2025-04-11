// server.js ou app.js
require('dotenv').config(); // Carregar variáveis de ambiente
const express = require('express');
const cors = require('cors');
const documentoRoutes = require('./routes/documentoRoutes'); // Importar as rotas de documentos
const authRoutes = require('./routes/authRoutes'); // Importar as rotas de autenticação

const app = express();
const port = process.env.PORT || 5000;

// Configurar o CORS para permitir requisições da origem http://localhost:3000
app.use(cors({ origin: 'http://localhost:3000' }));

// Middleware para lidar com dados JSON
app.use(express.json());

// Rotas da API
app.use('/api', documentoRoutes); 
app.use('/api/auth', authRoutes); // Usar o prefixo '/api/auth' para as rotas de autenticação

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
