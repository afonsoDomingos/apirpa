// services/mpesaService.js
const axios = require("axios");
const moment = require("moment"); // Instale: npm install moment
const btoa = require("btoa");    // Instale: npm install btoa
const { getAccessToken } = require("../utils/mpesaAuth");
require('dotenv').config();

const BUSINESS_SHORT_CODE = process.env.MPESA_BUSINESS_SHORT_CODE;
const MPESA_PASS_KEY = process.env.MPESA_PASS_KEY;
const MPESA_STKPUSH_URL = process.env.MPESA_STKPUSH_URL;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

const iniciarSTKPush = async ({ amount, phoneNumber, accountReference, transactionDesc }) => {
    try {
        const token = await getAccessToken();
        if (!token) {
            throw new Error("Token de acesso M-Pesa não disponível.");
        }

        const timestamp = moment().format("YYYYMMDDHHmmss");
        const password = btoa(`${BUSINESS_SHORT_CODE}${MPESA_PASS_KEY}${timestamp}`);

        const requestBody = {
            BusinessShortCode: BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline", // Para Paybill. "CustomerBuyGoodsOnline" para Till Number.
            Amount: amount,
            PartyA: phoneNumber, // Número do cliente no formato 2547xxxxxxxxx
            PartyB: BUSINESS_SHORT_CODE,
            PhoneNumber: phoneNumber, // Mesmo que PartyA
            CallBackURL: CALLBACK_URL,
            AccountReference: accountReference, // Referência única para sua transação
            TransactionDesc: transactionDesc || "Pagamento de Serviço/Assinatura",
        };

        console.log("Enviando STK Push Request:", JSON.stringify(requestBody, null, 2));

        const response = await axios.post(MPESA_STKPUSH_URL, requestBody, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        console.log("Resposta STK Push API:", JSON.stringify(response.data, null, 2));

        return response.data; // Retorna a resposta inicial (MerchantRequestID, CheckoutRequestID, ResponseCode)
    } catch (error) {
        console.error("Erro ao iniciar STK Push:", error.response ? error.response.data : error.message);
        throw new Error(`Erro ao iniciar STK Push: ${error.response ? (error.response.data.errorMessage || error.response.data.ResponseDescription) : error.message}`);
    }
};

module.exports = { iniciarSTKPush };