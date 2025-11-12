const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

class mpesaC2B {

    generateBearerToken(apiKey, publicKeyPem) {
        try {
            const encrypted = crypto.publicEncrypt(
                { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
                Buffer.from(apiKey)
            );
            return encrypted.toString('base64');
        } catch (error) {
            console.error('[mpesaC2B] Erro ao gerar token:', error.message);
            throw new Error('Erro ao gerar token: ' + error.message);
        }
    }

    generateCode() {
        const timestamp = Date.now().toString().slice(-7);  
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); 
        return `${timestamp}${randomNum}`;  
    }

    async payment(phone, amount, referenciaExterna = null) {
        console.log(`[mpesaC2B] Iniciando pagamento: phone=${phone}, amount=${amount}`);

        // Ajusta telefone para internacional
        if (!phone.startsWith('258')) {
            if (/^8\d{8}$/.test(phone)) phone = '258' + phone;
            else throw new Error('[mpesaC2B] Número de telefone inválido.');
        }

        const code = this.generateCode();
        const reference = referenciaExterna || `RpaLive${Date.now()}`;

        const payload = {
            input_TransactionReference: code,
            input_CustomerMSISDN: phone,
            input_Amount: amount,
            input_ThirdPartyReference: reference,
            input_ServiceProviderCode: config.serviceProviderCode,
        };

        try {
            const token = this.generateBearerToken(config.apiKey, config.publicKey);
            const response = await axios.post(
                'https://api.sandbox.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                        'Origin': 'developer.mpesa.vm.co.mz',
                    },
                }
            );

            return { status: 'success', data: response.data };
        } catch (error) {
            console.error('[mpesaC2B] Erro na API:', error.response?.data || error.message);
            return { status: 'error', message: error.response?.data || error.message };
        }
    }
}

module.exports = new mpesaC2B();
