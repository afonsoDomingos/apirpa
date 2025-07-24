const axios = require('axios');
const NodeRSA = require('node-rsa');
require('dotenv').config();

// Variáveis de ambiente
const MPESA_API_KEY = process.env.MPESA_API_KEY;
const MPESA_PUBLIC_KEY = process.env.MPESA_PUBLIC_KEY;
const MPESA_C2B_URL = process.env.MPESA_C2B_URL;
const MPESA_SERVICE_PROVIDER_CODE = process.env.MPESA_SERVICE_PROVIDER_CODE;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL;
const APP_ORIGIN = process.env.APP_ORIGIN; // <-- NOVA VARIÁVEL AQUI

// console.log para depuração (opcional, pode ser removido em produção)
console.log('--- Verificação de Variáveis de Ambiente no mpesaService ---');
console.log('MPESA_API_KEY:', MPESA_API_KEY ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_PUBLIC_KEY:', MPESA_PUBLIC_KEY ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_C2B_URL:', MPESA_C2B_URL ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_SERVICE_PROVIDER_CODE:', MPESA_SERVICE_PROVIDER_CODE ? 'Carregada' : 'NÃO CARREGADA');
console.log('MPESA_CALLBACK_URL:', MPESA_CALLBACK_URL ? 'Carregada' : 'NÃO CARREGADA');
console.log('APP_ORIGIN:', APP_ORIGIN ? 'Carregada' : 'NÃO CARREGADA'); // <-- Verificar APP_ORIGIN

// Verificação de variáveis de ambiente essenciais
if (!MPESA_API_KEY || !MPESA_PUBLIC_KEY || !MPESA_C2B_URL || !MPESA_SERVICE_PROVIDER_CODE || !MPESA_CALLBACK_URL || !APP_ORIGIN) {
    console.error("ERRO: Variáveis de ambiente M-Pesa essenciais em falta no mpesaService. Verifique seu arquivo .env.");
    process.exit(1); // Encerra o processo se as variáveis não estiverem configuradas
}

/**
 * Gera o token de autenticação (Bearer Token) para a API M-Pesa.
 * @param {string} apiKey A API Key fornecida pela M-Pesa.
 * @param {string} publicKey A Chave Pública RSA fornecida pela M-Pesa.
 * @returns {string} O Bearer Token encriptado.
 */
function getBearerToken(apiKey, publicKey) {
    try {
        const rsa = new NodeRSA(publicKey, { encryptionScheme: 'pkcs1_oaep' });
        const encryptedKey = rsa.encrypt(apiKey, 'base64');
        return encryptedKey;
    } catch (error) {
        console.error("Erro ao gerar o Bearer Token:", error.message);
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
        // Formatar o número de telefone para ter 12 dígitos, se necessário
        let formattedPhoneNumber = phoneNumber;
        if (formattedPhoneNumber.startsWith('8') && formattedPhoneNumber.length === 9) {
            formattedPhoneNumber = '258' + formattedPhoneNumber;
        }

        const bearerToken = getBearerToken(MPESA_API_KEY, MPESA_PUBLIC_KEY);

        const headers = {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
            'Origin': APP_ORIGIN // <-- ADICIONADO AQUI! O DOMÍNIO DA SUA API NO RENDER
        };

        const requestBody = {
            "input_Amount": amount.toString(), // O valor deve ser uma string
            "input_CustomerMSISDN": formattedPhoneNumber,
            "input_Country": "MZ",
            "input_Currency": "MZN",
            "input_ServiceProviderCode": MPESA_SERVICE_PROVIDER_CODE,
            "input_TransactionReference": transactionReference,
            "input_ThirdPartyReference": transactionReference, // Pode ser o mesmo que transactionReference
            "input_PurchasedItems": description,
            "input_ExpressPrompt": "true", // Para ativar o push USSD
            "input_CallbackUrl": MPESA_CALLBACK_URL // Sua URL para onde o M-Pesa enviará a resposta
        };

        console.log("Enviando Requisição STK Push M-Pesa para:", MPESA_C2B_URL);
        console.log("Headers:", headers);
        console.log("Body:", JSON.stringify(requestBody, null, 2));

        const response = await axios.post(MPESA_C2B_URL, requestBody, { headers });

        console.log("Resposta M-Pesa STK Push Recebida:", response.data);

        // Verifica se a resposta contém um erro da API M-Pesa
        if (response.data && response.data.output_ResponseCode && response.data.output_ResponseCode !== '0') {
            const errorDescription = response.data.output_ResponseDescription || "Erro desconhecido da API M-Pesa";
            const rawError = response.data.output_error || null;
            throw new Error(`Erro da API M-Pesa: ${errorDescription}` + (rawError ? ` (Detalhes: ${rawError})` : ''));
        }

        return response.data;

    } catch (error) {
        console.error("Erro ao iniciar pagamento M-Pesa:", error.message);
        console.error("Detalhes do erro (se disponível):", error.response ? error.response.data : error.message);

        let mpesaResponse = null;
        let errorMessage = "Erro desconhecido ao iniciar pagamento M-Pesa.";

        if (error.response && error.response.data) {
            mpesaResponse = error.response.data;
            errorMessage = mpesaResponse.output_ResponseDescription || mpesaResponse.output_error || "Erro da API M-Pesa.";
        } else {
            errorMessage = error.message;
        }

        throw {
            sucesso: false,
            mensagem: `Erro ao iniciar pagamento M-Pesa: ${errorMessage}`,
            mpesaResponse: {
                output_ResponseCode: (mpesaResponse && mpesaResponse.output_ResponseCode) || "ERR_API",
                output_ResponseDescription: errorMessage,
                rawResponse: mpesaResponse, // Inclui a resposta completa do M-Pesa para depuração
                isError: true
            }
        };
    }
}

module.exports = {
    iniciarSTKPush,
    getBearerToken
};