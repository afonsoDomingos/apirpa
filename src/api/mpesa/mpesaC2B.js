const axios = require('axios'); 
const crypto = require('crypto');
const config = require('./config');

// === URL DO NGROK (MUDA AQUI TODA VEZ QUE RODAR NGROK) ===
const WEBHOOK_URL = "https://apirpa.onrender.com/api/pagamentos/webhook";
//                   ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
//                   COLOCA A TUA URL DO NGROK AQUI!!!

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
            console.log('[mpesaC2B] Token Bearer gerado');
            return token;
        } catch (error) {
            console.error('[mpesaC2B] Erro ao gerar token:', error.message);
            throw new Error('Erro ao gerar token: ' + error.message);
        }
    }

    // === REFERÊNCIA ÚNICA (NUNCA MAIS INS-10) ===
    generateCode() {
      const uniqueRef = `RpaLive_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      console.log('[mpesaC2B] Referência única gerada:', uniqueRef);
      return uniqueRef;
    }

    async payment(phone, amount) {
        console.log(`[mpesaC2B] Iniciando pagamento: phone=${phone}, amount=${amount}`);

        // Garantir formato 25884...
        if (!phone.startsWith('258')) {
            if (/^8[4-7]\d{7}$/.test(phone)) {
                phone = '258' + phone;
                console.log(`[mpesaC2B] Prefixo 258 adicionado: ${phone}`);
            } else {
                throw new Error('[mpesaC2B] Número inválido. Use 84/85 + 7 dígitos.');
            }
        }

        const code = this.generateCode(); // ← referência única

        const payload = {
            input_TransactionReference: code,
            input_CustomerMSISDN: phone,
            input_Amount: amount,
            input_ThirdPartyReference: code,     // ← mesma ref única
            input_ServiceProviderCode: config.serviceProviderCode,
            input_CallbackUrl: WEBHOOK_URL       // ← RESOLVE O INS-9!!!
        };

        console.log('[mpesaC2B] Payload enviado:', payload);

        try {
            const token = this.generateBearerToken(config.apiKey, config.publicKey);

            console.log('[mpesaC2B] Enviando para M-Pesa sandbox...');
            const response = await axios.post(
                'https://api.sandbox.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/',
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                        'Origin': 'developer.mpesa.vm.co.mz',
                    },
                    timeout: 30000
                }
            );

            console.log('[mpesaC2B] SUCESSO! Resposta:', response.data);

            if (response.data.output_ResponseCode === 'INS-0') {
                return {
                    status: 'success',
                    data: response.data,
                    transactionId: response.data.output_TransactionID
                };
            } else {
                return {
                    status: 'failed',
                    error: response.data.output_ResponseDesc,
                    data: response.data
                };
            }

        } catch (error) {
            const erro = error.response?.data || error.message;
            console.error('[mpesaC2B] ERRO NA API:', erro);
            return {
                status: 'error',
                message: 'Falha na comunicação com M-Pesa',
                data: erro
            };
        }
    }
}

module.exports = new mpesaC2B();