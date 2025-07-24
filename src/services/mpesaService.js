const NodeRSA = require('node-rsa');
const fetch = require('node-fetch'); // Importa node-fetch para fazer requisições HTTP

/**
 * Gera o cabeçalho de autorização para chamadas à API M-Pesa Moçambique.
 */
function generateMozambiqueAuthHeader() {
    const publicKeyString = process.env.MPESA_MZ_PUBLIC_KEY;
    const apiKeyValue = process.env.MPESA_MZ_API_KEY;

    if (!publicKeyString) {
        throw new Error("Erro de Configuração: Variável de ambiente 'MPESA_MZ_PUBLIC_KEY' faltando.");
    }
    if (!apiKeyValue) {
        throw new Error("Erro de Configuração: Variável de ambiente 'MPESA_MZ_API_KEY' faltando.");
    }

    const key = new NodeRSA();
    key.importKey(publicKeyString, 'public');

    const encryptedApiKeyBase64 = key.encrypt(apiKeyValue, 'base64', 'utf8', 'pkcs1_v1_5');

    return `Bearer ${encryptedApiKeyBase64}`;
}

/**
 * Inicia um pagamento C2B (Customer-to-Business) via M-Pesa Moçambique.
 *
 * @param {number} amount O valor a ser cobrado.
 * @param {string} customerMsisdn Número do cliente (ex: "84XXXXXXX" ou "85XXXXXXX").
 * @param {string} transactionReference Referência única da transação (use UUID).
 * @param {string} purchasedItemsDesc Descrição dos produtos ou serviços.
 * @returns {Promise<object>} Resposta da API M-Pesa.
 */
async function iniciarSTKPush(amount, customerMsisdn, transactionReference, purchasedItemsDesc) {
    if (typeof amount !== 'number' || amount <= 0) {
        throw new Error("Erro de Validação: 'amount' deve ser um número positivo.");
    }
    if (!customerMsisdn || !/^258(84|85)\d{7}$/.test(customerMsisdn)) {
        throw new Error("Erro de Validação: 'customerMsisdn' inválido.");
    }
    if (!transactionReference || transactionReference.trim() === '') {
        throw new Error("Erro de Validação: 'transactionReference' não pode estar vazio.");
    }
    if (!purchasedItemsDesc || purchasedItemsDesc.trim() === '') {
        throw new Error("Erro de Validação: 'purchasedItemsDesc' não pode estar vazio.");
    }

    const baseUrl = process.env.MPESA_MZ_BASE_URL;
    const contextValue = process.env.MPESA_MZ_CONTEXT_VALUE;
    const origin = process.env.MPESA_MZ_ORIGIN;
    const serviceProviderCode = process.env.MPESA_MZ_SERVICE_PROVIDER_CODE;

    if (!baseUrl) throw new Error("Variável 'MPESA_MZ_BASE_URL' faltando.");
    if (!contextValue) throw new Error("Variável 'MPESA_MZ_CONTEXT_VALUE' faltando.");
    if (!origin) throw new Error("Variável 'MPESA_MZ_ORIGIN' faltando.");
    if (!serviceProviderCode) throw new Error("Variável 'MPESA_MZ_SERVICE_PROVIDER_CODE' faltando.");

    try {
        const authHeader = generateMozambiqueAuthHeader();
        const fullUrl = `${baseUrl}/${contextValue}/c2bPayment/singleStage/`;

        console.log("Enviando requisição para M-Pesa:", fullUrl); // Log da URL de requisição

        const requestBody = {
            "input_Amount": amount.toString(),
            "input_Country": "MOZ",
            "input_Currency": "MZN",
            "input_CustomerMSISDN": customerMsisdn,
            "input_ServiceProviderCode": serviceProviderCode,
            "input_ThirdPartyConversationID": transactionReference,
            "input_TransactionReference": transactionReference,
            "input_PurchasedItemsDesc": purchasedItemsDesc
        };

        const response = await fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
                "Origin": origin,
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Erro na API M-Pesa:", errorData); // Log do erro da API
            throw new Error(`Erro na API M-Pesa: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Erro ao iniciar pagamento M-Pesa:", error); // Log geral de erros
        throw error;
    }
}

// Exporta a função com nome em português para facilitar o uso no restante do código
module.exports = {
    iniciarSTKPush,
};
