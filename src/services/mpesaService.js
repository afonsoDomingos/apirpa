const NodeRSA = require('node-rsa');
const fetch = require('node-fetch'); // Importa node-fetch para fazer requisições HTTP

// Função para gerar o cabeçalho de autorização
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

// Função para iniciar o pagamento C2B (Customer-to-Business) via M-Pesa
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

        // Corrigindo o erro do body usado várias vezes
        const response = await fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
                "Origin": origin,
            },
            body: JSON.stringify(requestBody), // Garantir que o corpo é enviado uma única vez
        });

        if (!response.ok) {
            const textResponse = await response.text();
            if (textResponse.includes("<!DOCTYPE html>")) {
                throw new Error("Resposta da API M-Pesa em formato HTML. Verifique a URL ou os dados enviados.");
            }
            const errorData = await response.json();
            console.error("Erro na API M-Pesa:", errorData);
            throw new Error(`Erro na API M-Pesa: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Erro ao iniciar pagamento M-Pesa:", error);
        throw error;
    }
}

module.exports = { iniciarSTKPush };
