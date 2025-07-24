const axios = require('axios');
const NodeRSA = require('node-rsa');
require('dotenv').config(); // Garante que as variáveis de ambiente são carregadas

// Variáveis de ambiente
// Ler as variáveis de ambiente brutas
const RAW_MPESA_API_KEY = process.env.MPESA_API_KEY;
const RAW_MPESA_PUBLIC_KEY = process.env.MPESA_PUBLIC_KEY;

// Converter para Buffer explicitamente logo na leitura, se existirem
// Isso garante que são Buffers desde o início
const MPESA_API_KEY_BUFFER = RAW_MPESA_API_KEY ? Buffer.from(RAW_MPESA_API_KEY, 'utf8') : null;
const MPESA_PUBLIC_KEY_BUFFER = RAW_MPESA_PUBLIC_KEY ? Buffer.from(RAW_MPESA_PUBLIC_KEY, 'utf8') : null;

const MPESA_C2B_URL = process.env.MPESA_C2B_URL;
const MPESA_SERVICE_PROVIDER_CODE = process.env.MPESA_SERVICE_PROVIDER_CODE;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL;
const APP_ORIGIN = process.env.APP_ORIGIN; // Domínio da sua aplicação no Render

// --- Logs de Verificação de Variáveis (para depuração) ---
console.log('--- Verificação de Variáveis de Ambiente no mpesaService ---');
console.log('MPESA_API_KEY (Buffer):', MPESA_API_KEY_BUFFER ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_PUBLIC_KEY (Buffer):', MPESA_PUBLIC_KEY_BUFFER ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_C2B_URL:', MPESA_C2B_URL ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_SERVICE_PROVIDER_CODE:', MPESA_SERVICE_PROVIDER_CODE ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_CALLBACK_URL:', MPESA_CALLBACK_URL ? 'Carregada' : 'NÃO CARREGADA');
console.log('APP_ORIGIN:', APP_ORIGIN ? 'Carregada' : 'NÃO CARREGADA');

// Verificação de variáveis de ambiente essenciais (agora com base nos Buffers)
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
    console.log('--- DEBUG Bearer Token Generation (Attempt 6) ---');
    console.log('DEBUG: apiKeyBuffer recebida (tipo):', typeof apiKeyBuffer);
    console.log('DEBUG: apiKeyBuffer é um Buffer?', Buffer.isBuffer(apiKeyBuffer));
    console.log('DEBUG: publicKeyBuffer recebida (tipo):', typeof publicKeyBuffer);
    console.log('DEBUG: publicKeyBuffer é um Buffer?', Buffer.isBuffer(publicKeyBuffer));
    // --- FIM DOS NOVOS LOGS ---

    try {
        // Converter publicKeyBuffer para string antes de inicializar NodeRSA
        // O construtor do NodeRSA geralmente espera uma string PEM
        const publicKeyString = publicKeyBuffer.toString('utf8'); 

        // Inicializa NodeRSA com a chave pública (agora uma string)
        const rsa = new NodeRSA(publicKeyString, { encryptionScheme: 'pkcs1_oaep' });

        // Encripta a API Key (já é um Buffer) e retorna em base64
        const encryptedKey = rsa.encrypt(apiKeyBuffer, 'base64');
        return encryptedKey;
    } catch (error) {
        console.error("Erro ao gerar o Bearer Token (na função getBearerToken):", error.message);
        throw new Error("Falha ao gerar o token de autenticação M-Pesa.");
    }
}

/**
 * Inicia uma transação STK Push (C2B) via API M-Pesa.
 * @param {number} amount O valor a ser cobrado.
 * @param {string} phoneNumber O número de telefone do cliente (ex: "25884XXXXXXX" ou "84XXXXXXX").
 * @param {string} transactionReference Uma referência única para a transação.
 * @param {string} description Uma breve descrição da transação.
 * @returns {object} A resposta da API M-Pesa.
 */
async function iniciarSTKPush(amount, phoneNumber, transactionReference, description) {
    try {
        // Formatar o número de telefone para ter 12 dígitos (258xxxxxxxxx), se necessário
        let formattedPhoneNumber = phoneNumber;
        if (formattedPhoneNumber.startsWith('8') && formattedPhoneNumber.length === 9) {
            formattedPhoneNumber = '258' + formattedPhoneNumber;
        }

        // Chamar getBearerToken com os Buffers já criados globalmente
        const bearerToken = getBearerToken(MPESA_API_KEY_BUFFER, MPESA_PUBLIC_KEY_BUFFER);

        const headers = {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
            'Origin': APP_ORIGIN // Adiciona o cabeçalho Origin para validação da API M-Pesa
        };

        const requestBody = {
            "input_Amount": amount.toString(), // O valor deve ser uma string
            "input_CustomerMSISDN": formattedPhoneNumber,
            "input_Country": "MZ", // País
            "input_Currency": "MZN", // Moeda
            "input_ServiceProviderCode": MPESA_SERVICE_PROVIDER_CODE,
            "input_TransactionReference": transactionReference,
            "input_ThirdPartyReference": transactionReference, // Pode ser o mesmo que transactionReference
            "input_PurchasedItems": description,
            "input_ExpressPrompt": "true", // Para ativar o push USSD
            "input_CallbackUrl": MPESA_CALLBACK_URL // Sua URL para onde o M-Pesa enviará a resposta de callback
        };

        console.log("Enviando Requisição STK Push M-Pesa para:", MPESA_C2B_URL);
        console.log("Headers da Requisição:", headers);
        console.log("Corpo da Requisição (Body):", JSON.stringify(requestBody, null, 2));

        const response = await axios.post(MPESA_C2B_URL, requestBody, { headers });

        console.log("Resposta M-Pesa STK Push Recebida:", JSON.stringify(response.data, null, 2));

        // Verifica se a resposta contém um erro da API M-Pesa (códigos de resposta não-sucesso)
        if (response.data && response.data.output_ResponseCode && response.data.output_ResponseCode !== '0') {
            const errorDescription = response.data.output_ResponseDescription || "Erro desconhecido da API M-Pesa";
            const rawError = response.data.output_error || null; // Detalhes do erro, se houver
            throw new Error(`Erro da API M-Pesa: ${errorDescription}` + (rawError ? ` (Detalhes: ${JSON.stringify(rawError)})` : ''));
        }

        return response.data;

    } catch (error) {
        console.error("Erro ao iniciar pagamento M-Pesa:", error.message);
        console.error("Detalhes do erro completo (se disponível):", error.response ? error.response.data : error);

        let mpesaResponseData = null;
        let errorMessageForClient = "Erro desconhecido ao iniciar pagamento M-Pesa.";

        if (error.response && error.response.data) {
            mpesaResponseData = error.response.data;
            errorMessageForClient = mpesaResponseData.output_ResponseDescription || mpesaResponseData.output_error || "Erro da API M-Pesa.";
        } else {
            // Se não for um erro de resposta da API (ex: erro de rede, erro de Buffer, etc.)
            errorMessageForClient = error.message;
        }

        // Lança um objeto de erro padronizado para ser capturado pelo controlador
        throw {
            sucesso: false,
            mensagem: `Erro ao iniciar pagamento M-Pesa: ${errorMessageForClient}`,
            mpesaResponse: {
                output_ResponseCode: (mpesaResponseData && mpesaResponseData.output_ResponseCode) || "ERR_API",
                output_ResponseDescription: errorMessageForClient,
                rawResponse: mpesaResponseData, // Inclui a resposta completa do M-Pesa para depuração
                isError: true
            }
        };
    }
}

module.exports = {
    iniciarSTKPush,
    getBearerToken
};