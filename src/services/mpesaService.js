const axios = require('axios');
const NodeRSA = require('node-rsa');
require('dotenv').config(); // Garante que as variáveis de ambiente são carregadas

// Variáveis de ambiente
// Tentar converter para Buffer aqui, na leitura inicial
const RAW_MPESA_API_KEY = process.env.MPESA_API_KEY;
const RAW_MPESA_PUBLIC_KEY = process.env.MPESA_PUBLIC_KEY;

// Converter para Buffer explicitamente logo na leitura, se existirem
const MPESA_API_KEY_BUFFER = RAW_MPESA_API_KEY ? Buffer.from(RAW_MPESA_API_KEY, 'utf8') : null;
const MPESA_PUBLIC_KEY_BUFFER = RAW_MPESA_PUBLIC_KEY ? Buffer.from(RAW_MPESA_PUBLIC_KEY, 'utf8') : null;

const MPESA_C2B_URL = process.env.MPESA_C2B_URL;
const MPESA_SERVICE_PROVIDER_CODE = process.env.MPESA_SERVICE_PROVIDER_CODE;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL;
const APP_ORIGIN = process.env.APP_ORIGIN;

// --- Logs de Verificação de Variáveis (para depuração) ---
console.log('--- Verificação de Variáveis de Ambiente no mpesaService ---');
console.log('MPESA_API_KEY (Buffer):', MPESA_API_KEY_BUFFER ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_PUBLIC_KEY (Buffer):', MPESA_PUBLIC_KEY_BUFFER ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_C2B_URL:', MPESA_C2B_URL ? 'Carregada' : 'NÃO CARREGADA');
// ... (outros logs de variáveis de ambiente)

// Remova a verificação de API_KEY/PUBLIC_KEY aqui se já as converteu para Buffer
if (!MPESA_API_KEY_BUFFER || !MPESA_PUBLIC_KEY_BUFFER || !MPESA_C2B_URL || !MPESA_SERVICE_PROVIDER_CODE || !MPESA_CALLBACK_URL || !APP_ORIGIN) {
    console.error("ERRO: Variáveis de ambiente M-Pesa essenciais em falta no mpesaService. Verifique seu arquivo .env e no Render.");
}

/**
 * Gera o token de autenticação (Bearer Token) para a API M-Pesa.
 * Encripta a API Key usando a Public Key RSA.
 * @param {Buffer} apiKeyBuffer A API Key como Buffer.
 * @param {Buffer} publicKeyBuffer A Chave Pública RSA como Buffer.
 * @returns {string} O Bearer Token encriptado em base64.
 */
function getBearerToken(apiKeyBuffer, publicKeyBuffer) {
    // --- NOVOS LOGS DE DEPURAÇÃO NO INÍCIO DA FUNÇÃO (mudados para Buffer) ---
    console.log('--- DEBUG Bearer Token Generation (Attempt 5) ---');
    console.log('DEBUG: apiKeyBuffer recebida (tipo):', typeof apiKeyBuffer);
    console.log('DEBUG: apiKeyBuffer é um Buffer?', Buffer.isBuffer(apiKeyBuffer));
    console.log('DEBUG: publicKeyBuffer recebida (tipo):', typeof publicKeyBuffer);
    console.log('DEBUG: publicKeyBuffer é um Buffer?', Buffer.isBuffer(publicKeyBuffer));
    // --- FIM DOS NOVOS LOGS ---

    try {
        // Inicializa NodeRSA com a chave pública (agora um Buffer)
        // NodeRSA deve ser capaz de processar um Buffer diretamente aqui
        const rsa = new NodeRSA(publicKeyBuffer, { encryptionScheme: 'pkcs1_oaep' });

        // A linha que causava erro foi movida para fora desta função
        // Não precisamos mais de Buffer.from(apiKey, 'utf8'); aqui

        // Encripta a API Key (já é um Buffer) e retorna em base64
        const encryptedKey = rsa.encrypt(apiKeyBuffer, 'base64');
        return encryptedKey;
    } catch (error) {
        console.error("Erro ao gerar o Bearer Token (na função getBearerToken):", error.message);
        throw new Error("Falha ao gerar o token de autenticação M-Pesa.");
    }
}

// A função iniciarSTKPush precisa chamar getBearerToken com os novos Buffers
async function iniciarSTKPush(amount, phoneNumber, transactionReference, description) {
    try {
        let formattedPhoneNumber = phoneNumber;
        if (formattedPhoneNumber.startsWith('8') && formattedPhoneNumber.length === 9) {
            formattedPhoneNumber = '258' + formattedPhoneNumber;
        }

        // Chamar com os Buffers já criados globalmente
        const bearerToken = getBearerToken(MPESA_API_KEY_BUFFER, MPESA_PUBLIC_KEY_BUFFER); 

        // ... (restante do código da função iniciarSTKPush) ...

    } catch (error) {
        // ... (tratamento de erros existente) ...
    }
}

module.exports = {
    iniciarSTKPush,
    getBearerToken // Manter exportado para consistência, se necessário para testes
};