// server.js
require('dotenv').config(); // Carrega as variáveis de ambiente do .env

const apiKey = process.env.MPESA_API_KEY;
const publicKey = process.env.MPESA_PUBLIC_KEY;
const mpesaC2bUrl = process.env.MPESA_C2B_URL; // Usando o nome correto da variável

console.log("Variáveis de ambiente carregadas:");
console.log(`API Key: ${apiKey ? 'Carregada' : 'NÃO CARREGADA'}`);
console.log(`Public Key: ${publicKey ? 'Carregada' : 'NÃO CARREGADA'}`);
console.log(`M-Pesa C2B URL: ${mpesaC2bUrl ? 'Carregada' : 'NÃO CARREGADA'}`);


const express = require('express');
const app = express();
const cors = require('cors');
const connectDB = require('./config/db'); // Assumindo que você tem este arquivo para conexão com o DB
const Documento = require('./models/documentoModel'); // Assumindo que você tem este modelo

// Importar rotas
const chatbotRoute = require('./routes/chatbot'); // Exemplo de rota existente
const documentoRoutes = require('./routes/documentoRoutes.js'); // Exemplo de rota existente
const authRoutes = require('./routes/authRoutes.js'); // Exemplo de rota existente
const solicitacoesRouter = require('./routes/solicitacoesRoutes'); // Exemplo de rota existente
const documentosGuardadosRoutes = require('./routes/documentosGuardadosRoutes.js'); // Exemplo de rota existente
const pagamentoRoutes = require("./routes/pagamentoRoutes"); // Suas rotas de pagamento
const { mpesaCallbackHandler } = require("./controllers/mpesaCallbackController"); // Controlador de callback M-Pesa

const port = process.env.PORT || 5000;

// ⚠️ Middleware JSON - deve vir ANTES de usar rotas com req.body JSON
app.use(express.json());

// CORS
const allowedOrigins = ['https://recuperaaqui.vercel.app', 'http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem 'origin' (ex: de ferramentas como Postman ou curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE','OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200,
}));

// Rota simples para testar a API
app.get('/', (req, res) => res.send('API rodando com sucesso!'));

// Rota API do Chatbot (exemplo)
app.use('/api/chatbot', chatbotRoute);

// --- Rota de Callback da M-Pesa ---
// Esta rota deve ser acessível publicamente pela M-Pesa.
// O middleware `express.raw` é crucial aqui para lidar com o corpo da requisição
// que pode não ser estritamente 'application/json' ou ser um Buffer.
// O `mpesaCallbackHandler` dentro do controlador foi ajustado para parsear este Buffer.
// O caminho '/api/pagamentos/mpesa/callback' DEVE corresponder à sua MPESA_CALLBACK_URL no .env
app.post(
    "/api/pagamentos/mpesa/callback",
    express.raw({ type: "*/*" }), // Aceita qualquer tipo de conteúdo como buffer
    mpesaCallbackHandler
);

// Conectar ao MongoDB e iniciar servidor
connectDB() // Assume que connectDB é uma função que retorna uma Promise
    .then(() => {
        console.log('Conectado ao MongoDB com sucesso!');

        // --- Outras rotas da sua aplicação ---
        app.use('/api', documentoRoutes); 
        app.use('/api/auth', authRoutes);
        app.use('/api', solicitacoesRouter);
        app.use('/api/documentosguardados', documentosGuardadosRoutes);
        
        // Suas rotas de pagamento (inclui a lógica para iniciar M-Pesa C2B)
        app.use('/api/pagamentos', pagamentoRoutes);

        // Contador de documentos reportados (exemplo)
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
            console.log(`Aguardando requisições...`);
        });
    })
    .catch(err => {
        console.error('Erro ao conectar ao banco de dados:', err);
        process.exit(1); // Encerra a aplicação se a conexão ao DB falhar
    });