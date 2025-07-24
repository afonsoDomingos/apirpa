// services/mpesaService.js
const axios = require('axios');
const NodeRSA = require('node-rsa');
require('dotenv').config();

const MPESA_API_KEY = process.env.MPESA_API_KEY;
const MPESA_PUBLIC_KEY = process.env.MPESA_PUBLIC_KEY;
const MPESA_C2B_URL = process.env.MPESA_C2B_URL; // Usando MPESA_C2B_URL
const MPESA_SERVICE_PROVIDER_CODE = process.env.MPESA_SERVICE_PROVIDER_CODE;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

if (!MPESA_API_KEY || !MPESA_PUBLIC_KEY || !MPESA_C2B_URL || !MPESA_SERVICE_PROVIDER_CODE || !MPESA_CALLBACK_URL) {
    console.error("ERRO: Variáveis de ambiente M-Pesa essenciais em falta. Verifique seu arquivo .env.");
    process.exit(1);
}

function getBearerToken(apiKey, publicKey) {
    try {
        const key = new NodeRSA();
        key.importKey(publicKey, 'pkcs8-public');
        const encryptedApiKey = key.encrypt(apiKey, 'base64', 'utf8', 'pkcs1_padding');
        return encryptedApiKey;
    } catch (error) {
        console.error("Erro ao encriptar a Chave API:", error.message);
        throw new Error("Falha ao gerar o token Bearer M-Pesa.");
    }
}

async function iniciarSTKPush(amount, phoneNumber, transactionReference, description) {
    try {
        const bearerToken = getBearerToken(MPESA_API_KEY, MPESA_PUBLIC_KEY);

        const headers = {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
        };

        const requestBody = {
            input_ServiceProviderCode: MPESA_SERVICE_PROVIDER_CODE,
            input_Amount: amount.toFixed(2).toString(),
            input_TransactionReference: transactionReference,
            input_CustomerMSISDN: phoneNumber,
            input_ThirdPartyReference: transactionReference,
            input_Country: "MZ",
            input_Currency: "MZN",
            input_PurchasedItems: description
        };

        if (MPESA_CALLBACK_URL) {
            requestBody.input_CallbackURL = MPESA_CALLBACK_URL;
        }

        console.log("Enviando Requisição STK Push M-Pesa:", JSON.stringify(requestBody, null, 2));

        const response = await axios.post(MPESA_C2B_URL, requestBody, { headers });

        console.log("Resposta M-Pesa STK Push Recebida:", JSON.stringify(response.data, null, 2));

        return {
            output_ResponseCode: response.data.output_ResponseCode || response.data.ResponseCode || null,
            output_MerchantRequestID: response.data.output_MerchantRequestID || response.data.MerchantRequestID || null,
            output_CheckoutRequestID: response.data.output_CheckoutRequestID || response.data.CheckoutRequestID || null,
            output_CustomerMessage: response.data.output_CustomerMessage || response.data.CustomerMessage || null,
            output_ResponseDescription: response.data.output_ResponseDescription || response.data.ResponseDescription || response.data.Message || null,
            rawResponse: response.data
        };

    } catch (error) {
        console.error("Erro ao iniciar STK Push M-Pesa:", error.message);
        if (error.response) {
            console.error("Dados da Resposta de ERRO da API M-Pesa:", JSON.stringify(error.response.data, null, 2));
            return {
                output_ResponseCode: error.response.data.output_ResponseCode || error.response.data.ResponseCode || 'ERR_API',
                output_ResponseDescription: error.response.data.output_ResponseDescription || error.response.data.ResponseDescription || error.response.data.Message || 'Erro desconhecido da API M-Pesa',
                rawResponse: error.response.data,
                isError: true
            };
        }
        throw new Error(`Erro na comunicação com M-Pesa: ${error.message}`);
    }
}

module.exports = {
    iniciarSTKPush,
    getBearerToken
};