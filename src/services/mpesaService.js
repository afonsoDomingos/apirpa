const NodeRSA = require('node-rsa');
// const btoa = require('btoa'); // Removi, pois em Node.js moderno geralmente não é necessário, ou use Buffer.from().toString('base64')

function generateMozambiqueAuthHeader() {
    const publicKeyString = process.env.MPESA_MZ_PUBLIC_KEY;
    const apiKeyValue = process.env.MPESA_MZ_API_KEY;

    const key = new NodeRSA();
    key.importKey(publicKeyString, 'public');

    const encryptedApiKeyBase64 = key.encrypt(apiKeyValue, 'base64', 'utf8', 'pkcs1_v1_5');

    return `Bearer ${encryptedApiKeyBase64}`;
}

// Esta é a função que você quer exportar como 'iniciarSTKPush'
async function initiateC2BMozambique(amount, customerMsisdn, serviceProviderCode, transactionReference, purchasedItemsDesc) {
    const authHeader = generateMozambiqueAuthHeader();
    const fullUrl = `${process.env.MPESA_MZ_BASE_URL}/${process.env.MPESA_MZ_CONTEXT_VALUE}/c2bPayment/singleStage/`;

    const requestBody = {
        "input_Amount": amount.toString(),
        "input_Country": "MOZ",
        "input_Currency": "MZN",
        "input_CustomerMSISDN": customerMsisdn,
        "input_ServiceProviderCode": serviceProviderCode,
        "input_ThirdPartyConversationID": transactionReference, // Use transactionReference aqui se for seu UUID
        "input_TransactionReference": transactionReference,
        "input_PurchasedItemsDesc": purchasedItemsDesc
    };

    try {
        const response = await fetch(fullUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
                "Origin": process.env.MPESA_MZ_ORIGIN,
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

// --- ADICIONE ESTA LINHA NO FINAL DO ARQUIVO ---
module.exports = {
    iniciarSTKPush: initiateC2BMozambique, // Exporta 'initiateC2BMozambique' como 'iniciarSTKPush'
    // Você também pode exportar generateMozambiqueAuthHeader se precisar dela em outro lugar:
    // generateMozambiqueAuthHeader: generateMozambiqueAuthHeader,
};

// Se você está usando 'uuid' para ThirdPartyConversationID, lembre-se de importar:
// const { v4: uuidv4 } = require('uuid');
// E usar uuidv4() para gerar o ID único.
// Por exemplo, na sua rota de pagamentos, onde você já está gerando o accountReference,
// você pode usar o mesmo valor ou um novo UUID para input_ThirdPartyConversationID.
// Eu alterei o 'YOUR_UNIQUE_UUID_HERE' para 'transactionReference' no requestBody acima,
// mas se você tem um UUID separado, pode passá-lo como um novo parâmetro para initiateC2BMozambique.