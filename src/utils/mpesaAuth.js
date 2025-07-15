// utils/mpesaAuth.js
const unirest = require('unirest'); // Importar a biblioteca unirest
const btoa = require("btoa"); // Instale: npm install btoa
require('dotenv').config();

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_AUTH_URL = process.env.MPESA_AUTH_URL;

let accessToken = null;
let tokenExpiryTime = 0; // Timestamp de expiração em milissegundos

const getAccessToken = async () => {
    const now = Date.now();
    // Se o token ainda é válido (com uma margem de segurança de 5 minutos)
    if (accessToken && (tokenExpiryTime - now > 300 * 1000)) {
        console.log("M-Pesa Access Token em cache reutilizado.");
        return accessToken;
    }

    try {
        const auth = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);

        // Usando o seu código unirest aqui
        const res = await new Promise((resolve, reject) => {
            unirest('GET', MPESA_AUTH_URL)
                .headers({ 'Authorization': `Basic ${auth}` })
                .send()
                .end(response => {
                    if (response.error) {
                        return reject(response.error);
                    }
                    resolve(response);
                });
        });

        const responseData = JSON.parse(res.raw_body); // unirest retorna raw_body, você precisa parsear

        accessToken = responseData.access_token;
        // Tempo de expiração (geralmente 3600 segundos = 1 hora)
        tokenExpiryTime = now + (responseData.expires_in * 1000);
        console.log("M-Pesa Access Token gerado com sucesso com Unirest!");
        return accessToken;
    } catch (error) {
        console.error("Erro ao gerar M-Pesa Access Token com Unirest:", error.message);
        throw new Error("Falha ao gerar M-Pesa Access Token. Verifique suas Consumer Key/Secret e conexão.");
    }
};

module.exports = { getAccessToken };