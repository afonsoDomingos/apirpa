const NodeRSA = require('node-rsa');
const fetch = require('node-fetch'); // Importa node-fetch para fazer requisições HTTP

// Função para gerar o cabeçalho de autorização
function generateMozambiqueAuthHeader() {
    const publicKeyString = process.env.MPESA_MZ_PUBLIC_KEY;
    const apiKeyValue = process.env.MPESA_MZ_API_KEY;

    if (!publicKeyString) {
        console.error("Erro de Configuração: Variável de ambiente 'MPESA_MZ_PUBLIC_KEY' faltando.");
        throw new Error("Erro de Configuração: Variável de ambiente 'MPESA_MZ_PUBLIC_KEY' faltando.");
    }
    if (!apiKeyValue) {
        console.error("Erro de Configuração: Variável de ambiente 'MPESA_MZ_API_KEY' faltando.");
        throw new Error("Erro de Configuração: Variável de ambiente 'MPESA_MZ_API_KEY' faltando.");
    }

    const key = new NodeRSA();
    key.importKey(publicKeyString, 'public');

    const encryptedApiKeyBase64 = key.encrypt(apiKeyValue, 'base64', 'utf8', 'pkcs1_v1_5');

    console.log("Cabeçalho de autorização gerado com sucesso.");
    return `Bearer ${encryptedApiKeyBase64}`;
}

// Função para iniciar o pagamento C2B (Customer-to-Business) via M-Pesa
async function iniciarSTKPush(amount, customerMsisdn, transactionReference, purchasedItemsDesc) {
    console.log("Iniciando o pagamento C2B via M-Pesa...");

    if (typeof amount !== 'number' || amount <= 0) {
        console.error("Erro de Validação: 'amount' deve ser um número positivo.");
        throw new Error("Erro de Validação: 'amount' deve ser um número positivo.");
    }
    if (!customerMsisdn || !/^258(84|85)\d{7}$/.test(customerMsisdn)) {
        console.error("Erro de Validação: 'customerMsisdn' inválido.");
        throw new Error("Erro de Validação: 'customerMsisdn' inválido.");
    }
    if (!transactionReference || transactionReference.trim() === '') {
        console.error("Erro de Validação: 'transactionReference' não pode estar vazio.");
        throw new Error("Erro de Validação: 'transactionReference' não pode estar vazio.");
    }
    if (!purchasedItemsDesc || purchasedItemsDesc.trim() === '') {
        console.error("Erro de Validação: 'purchasedItemsDesc' não pode estar vazio.");
        throw new Error("Erro de Validação: 'purchasedItemsDesc' não pode estar vazio.");
    }

    const baseUrl = process.env.MPESA_MZ_BASE_URL;
    const contextValue = process.env.MPESA_MZ_CONTEXT_VALUE;
    const origin = process.env.MPESA_MZ_ORIGIN;
    const serviceProviderCode = process.env.MPESA_MZ_SERVICE_PROVIDER_CODE;

    if (!baseUrl) {
        console.error("Erro de Configuração: Variável 'MPESA_MZ_BASE_URL' faltando.");
        throw new Error("Variável 'MPESA_MZ_BASE_URL' faltando.");
    }
    if (!contextValue) {
        console.error("Erro de Configuração: Variável 'MPESA_MZ_CONTEXT_VALUE' faltando.");
        throw new Error("Variável 'MPESA_MZ_CONTEXT_VALUE' faltando.");
    }
    if (!origin) {
        console.error("Erro de Configuração: Variável 'MPESA_MZ_ORIGIN' faltando.");
        throw new Error("Variável 'MPESA_MZ_ORIGIN' faltando.");
    }
    if (!serviceProviderCode) {
        console.error("Erro de Configuração: Variável 'MPESA_MZ_SERVICE_PROVIDER_CODE' faltando.");
        throw new Error("Variável 'MPESA_MZ_SERVICE_PROVIDER_CODE' faltando.");
    }

    try {
        const authHeader = generateMozambiqueAuthHeader();
        const fullUrl = `${baseUrl}:${process.env.MPESA_MZ_PORTA}/${contextValue}/c2bPayment/singleStage/`;

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

        console.log("Corpo da requisição:", JSON.stringify(requestBody, null, 2)); // Log do corpo da requisição

        // Garantir que o corpo é enviado uma única vez
        const response = await fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
                "Origin": origin,
            },
            body: JSON.stringify(requestBody), // Corpo enviado uma única vez
        });

        console.log("Resposta recebida de M-Pesa. Status:", response.status);

        if (!response.ok) {
            const textResponse = await response.text();
            if (textResponse.includes("<!DOCTYPE html>")) {
                console.error("Resposta da API M-Pesa em formato HTML. Verifique a URL ou os dados enviados.");
                throw new Error("Resposta da API M-Pesa em formato HTML. Verifique a URL ou os dados enviados.");
            }
            const errorData = await response.json();
            console.error("Erro na API M-Pesa:", errorData);
            throw new Error(`Erro na API M-Pesa: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log("Resposta JSON recebida:", JSON.stringify(data, null, 2));

        return data;

    } catch (error) {
        console.error("Erro ao iniciar pagamento M-Pesa:", error);
        throw error;
    }
}

module.exports = { iniciarSTKPush };
