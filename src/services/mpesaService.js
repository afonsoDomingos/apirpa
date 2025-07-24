const axios = require('axios');
// const NodeRSA = require('node-rsa'); // REMOVIDO: Não usaremos mais node-rsa
const crypto = require('crypto'); // NOVO: Módulo crypto nativo
require('dotenv').config();

// Variáveis de ambiente
const RAW_MPESA_API_KEY = process.env.MPESA_API_KEY;
const RAW_MPESA_PUBLIC_KEY = process.env.MPESA_PUBLIC_KEY;

// Convertendo para Buffer explicitamente logo na leitura, se existirem
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
console.log('MPESA_SERVICE_PROVIDER_CODE:', MPESA_SERVICE_PROVIDER_CODE ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_CALLBACK_URL:', MPESA_CALLBACK_URL ? 'Carregada' : 'NÃO CARREGADA');
console.log('APP_ORIGIN:', APP_ORIGIN ? 'Carregada' : 'NÃO CARREGADA');

if (!MPESA_API_KEY_BUFFER || !MPESA_PUBLIC_KEY_BUFFER || !MPESA_C2B_URL || !MPESA_SERVICE_PROVIDER_CODE || !MPESA_CALLBACK_URL || !APP_ORIGIN) {
    console.error("ERRO: Variáveis de ambiente M-Pesa essenciais em falta no mpesaService. Verifique seu arquivo .env e no Render.");
}

/**
 * Gera o token de autenticação (Bearer Token) para a API M-Pesa usando o módulo crypto nativo.
 * Encripta a API Key usando a Public Key RSA.
 * @param {Buffer} apiKeyBuffer A API Key como Buffer.
 * @param {Buffer} publicKeyBuffer A Chave Pública RSA como Buffer (conteúdo PEM).
 * @returns {string} O Bearer Token encriptado em base64.
 */
function getBearerToken(apiKeyBuffer, publicKeyBuffer) {
    // --- NOVOS LOGS DE DEPURAÇÃO NO INÍCIO DA FUNÇÃO (mudados para Buffer) ---
    console.log('--- DEBUG Bearer Token Generation (Using Node Crypto) ---');
    console.log('DEBUG: apiKeyBuffer recebida (tipo):', typeof apiKeyBuffer);
    console.log('DEBUG: apiKeyBuffer é um Buffer?', Buffer.isBuffer(apiKeyBuffer));
    console.log('DEBUG: publicKeyBuffer recebida (tipo):', typeof publicKeyBuffer);
    console.log('DEBUG: publicKeyBuffer é um Buffer?', Buffer.isBuffer(publicKeyBuffer));
    // --- FIM DOS NOVOS LOGS ---

    try {
        // publicKeyBuffer já deve ser o conteúdo PEM completo com cabeçalhos e rodapés
        // crypto.publicEncrypt espera a chave pública em formato de string PEM ou Buffer
        const encryptedKey = crypto.publicEncrypt(
            {
                key: publicKeyBuffer, // Passamos o Buffer diretamente aqui
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, // Padding OAEP como especificado
                oaepHash: 'sha256' // Hashing para OAEP, geralmente SHA256 para M-Pesa
            },
            apiKeyBuffer // O dado a ser encriptado, já um Buffer
        ).toString('base64'); // Converte o resultado da encriptação para base64

        return encryptedKey;
    } catch (error) {
        console.error("Erro ao gerar o Bearer Token (na função getBearerToken com crypto nativo):", error.message);
        throw new Error("Falha ao gerar o token de autenticação M-Pesa.");
    }
}

// ... (o restante do seu código iniciarSTKPush e module.exports permanece o mesmo) ...
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
        let formattedPhoneNumber = phoneNumber;
        if (formattedPhoneNumber.startsWith('8') && formattedPhoneNumber.length === 9) {
            formattedPhoneNumber = '258' + formattedPhoneNumber;
        }

        const bearerToken = getBearerToken(MPESA_API_KEY_BUFFER, MPESA_PUBLIC_KEY_BUFFER);

        const headers = {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
            'Origin': APP_ORIGIN
        };

        const requestBody = {
            "input_Amount": amount.toString(),
            "input_CustomerMSISDN": formattedPhoneNumber,
            "input_Country": "MZ",
            "input_Currency": "MZN",
            "input_ServiceProviderCode": MPESA_SERVICE_PROVIDER_CODE,
            "input_TransactionReference": transactionReference,
            "input_ThirdPartyReference": transactionReference,
            "input_PurchasedItems": description,
            "input_ExpressPrompt": "true",
            "input_CallbackUrl": MPESA_CALLBACK_URL
        };

        console.log("Enviando Requisição STK Push M-Pesa para:", MPESA_C2B_URL);
        console.log("Headers da Requisição:", headers);
        console.log("Corpo da Requisição (Body):", JSON.stringify(requestBody, null, 2));

        const response = await axios.post(MPESA_C2B_URL, requestBody, { headers });

        console.log("Resposta M-Pesa STK Push Recebida:", JSON.stringify(response.data, null, 2));

        if (response.data && response.data.output_ResponseCode && response.data.output_ResponseCode !== '0') {
            const errorDescription = response.data.output_ResponseDescription || "Erro desconhecido da API M-Pesa";
            const rawError = response.data.output_error || null;
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
            errorMessageForClient = error.message;
        }

        throw {
            sucesso: false,
            mensagem: `Erro ao iniciar pagamento M-Pesa: ${errorMessageForClient}`,
            mpesaResponse: {
                output_ResponseCode: (mpesaResponseData && mpesaResponseData.output_ResponseCode) || "ERR_API",
                output_ResponseDescription: errorMessageForClient,
                rawResponse: mpesaResponseData,
                isError: true
            }
        };
    }
}

module.exports = {
    iniciarSTKPush,
    getBearerToken
};