const axios = require('axios'); 
const crypto = require('crypto');
const config = require('./config');

class mpesaC2B {

    generateBearerToken(apiKey, publicKeyPem) {
        try {
            console.log('[mpesaC2B] Gerando token Bearer...');
            const encrypted = crypto.publicEncrypt(
                {
                    key: publicKeyPem,
                    padding: crypto.constants.RSA_PKCS1_PADDING,
                },
                Buffer.from(apiKey)
            );
            const token = encrypted.toString('base64');
            console.log('[mpesaC2B] Token Bearer gerado:', token);
            return token;
        } catch (error) {
            console.error('[mpesaC2B] Erro ao gerar token:', error.message);
            throw new Error('Erro ao gerar token: ' + error.message);
        }
    }

    generateCode() {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('[mpesaC2B] Código gerado para transação:', code);
        return code;
    }

    async payment(phone, amount) {
        console.log(`[mpesaC2B] Iniciando pagamento: phone=${phone}, amount=${amount}`);

        const code = this.generateCode();
       // const reference = 'GibraLive';
        const reference = 'RpaLive';
       // const reference = `Rpademo-${Date.now()}`;
        console.log(`[mpesaC2B] Referência gerada: ${reference}`);


        const payload = {
            input_TransactionReference: code,
           // input_CustomerMSISDN: `258${phone}`,
            input_CustomerMSISDN: phone,
            input_Amount: amount,
            input_ThirdPartyReference: reference,
            input_ServiceProviderCode: config.serviceProviderCode,
        };

        console.log('[mpesaC2B] Payload para API:', payload);

        try {
            // Gerar token criptografado com chave pública
            const token = this.generateBearerToken(config.apiKey, config.publicKey);

            console.log('[mpesaC2B] Fazendo requisição para API M-Pesa sandbox...');
            const response = await axios.post(
                'https://api.sandbox.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,  // usa token gerado
                        'Origin': 'developer.mpesa.vm.co.mz',
                    },
                }
            );

            console.log('[mpesaC2B] Resposta da API recebida:', response.data);

            return {
                status: 'success',
                data: response.data,
            };
        } catch (error) {
            console.error('[mpesaC2B] Erro na requisição à API:', error.response?.data || error.message);
            return {
                status: 'error',
                message: error.response?.data || error.message,
            };
        }
    }
}

module.exports = new mpesaC2B();
