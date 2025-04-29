// server.js ou app.js
require('dotenv').config(); // Carregar variáveis de ambiente
const express = require('express');
const cors = require('cors');
const documentoRoutes = require('./routes/documentoRoutes'); // Importar as rotas de documentos
const authRoutes = require('./routes/authRoutes'); // Importar as rotas de autenticação

const app = express();
const port = process.env.PORT || 5000;

// Configurar o CORS para permitir requisições da origem http://localhost:3000 
//app.use(cors({ origin: 'http://localhost:3000' }));


// ✅ CORS correto:
app.use(cors({
  origin: 'https://recuperaaqui.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
//app.use(cors({ origin: 'https://apirpa.onrender.com' }));

// Middleware para lidar com dados JSON
app.use(express.json());

// Rotas da API
app.get('/', (req, res) => {
  res.send('API rodando com sucesso!');
});
app.use('/api', documentoRoutes); 
app.use('/api/auth', authRoutes); // Usar o prefixo '/api/auth' para as rotas de autenticação



// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
