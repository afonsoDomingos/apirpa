const NodeRSA = require('node-rsa');
const btoa = require('btoa'); // Para Base64 encoding (se não estiver em um ambiente de navegador)

function generateMozambiqueAuthHeader() {
    const publicKeyString = process.env.MPESA_MZ_PUBLIC_KEY;
    const apiKeyValue = process.env.MPESA_MZ_API_KEY;

    const key = new NodeRSA();
    // Importa a chave pública. O formato aqui é crucial.
    // Se a chave pública não tiver os cabeçalhos PEM (-----BEGIN PUBLIC KEY-----),
    // NodeRSA ainda pode importá-la como 'public' se for Base64 puro.
    key.importKey(publicKeyString, 'public');

    // Criptografa a API Key. O padding é PKCS1_v1_5 conforme o exemplo Java.
    // 'utf8' é o encoding do apiKey, 'base64' é o encoding da saída.
    const encryptedApiKeyBase64 = key.encrypt(apiKeyValue, 'base64', 'utf8', 'pkcs1_v1_5');

    // A string resultante é o seu token Bearer.
    return `Bearer ${encryptedApiKeyBase64}`;
}

// Exemplo de como você faria uma chamada C2B (recapitulando o payload)
async function initiateC2BMozambique(amount, customerMsisdn, serviceProviderCode, transactionReference, purchasedItemsDesc) {
    const authHeader = generateMozambiqueAuthHeader();
    const fullUrl = `${process.env.MPESA_MZ_BASE_URL}/${process.env.MPESA_MZ_CONTEXT_VALUE}/c2bPayment/singleStage/`; // MPESA_MZ_CONTEXT_VALUE = 'vodacomMOZ'

    const requestBody = {
        "input_Amount": amount.toString(), // Converter para string se for número
        "input_Country": "MOZ",
        "input_Currency": "MZN",
        "input_CustomerMSISDN": customerMsisdn, // Ex: "2588400000001"
        "input_ServiceProviderCode": serviceProviderCode,
        "input_ThirdPartyConversationID": "YOUR_UNIQUE_UUID_HERE", // Gerar um UUID único
        "input_TransactionReference": transactionReference,
        "input_PurchasedItemsDesc": purchasedItemsDesc
    };

    try {
        const response = await fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader, // Seu Bearer Token criptografado
                "Origin": process.env.MPESA_MZ_ORIGIN, // Seu domínio do Render
                // Pode ser necessário incluir "X-Origin-Key" com sua API Key, dependendo da docs.
                // "X-Origin-Key": process.env.MPESA_MZ_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Erro na API M-Pesa Moçambique:", errorData);
            throw new Error(`M-Pesa API error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log("Resposta M-Pesa Moçambique:", data);
        return data;

    } catch (error) {
        console.error("Erro ao iniciar pagamento M-Pesa Moçambique:", error);
        throw error;
    }
}