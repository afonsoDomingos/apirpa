// api/mpesa/mpesaC2B.js
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
      console.log('[mpesaC2B] Token Bearer gerado com sucesso');
      return token;
    } catch (error) {
      console.error('[mpesaC2B] Erro ao gerar token:', error.message);
      throw error;
    }
  }

  // Gera código de 10 caracteres (7 timestamp + 3 random) → FUNCIONA NO SANDBOX MZ
  generateCode() {
    const timestamp = Date.now().toString().slice(-7);
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const code = `${timestamp}${randomNum}`;
    console.log('[mpesaC2B] input_TransactionReference gerado:', code);
    return code;
  }

  async payment(phone, amount, customReference = null) {
    console.log(`[mpesaC2B] Iniciando pagamento: phone=${phone}, amount=${amount}`);

    // === CORREÇÃO DO NÚMERO (aceita 84... ou 25884...) ===
    let formattedPhone = phone.toString().replace(/[^0-9]/g, '');

    if (formattedPhone.startsWith('258')) {
      formattedPhone = formattedPhone.substring(3);
    }

    if (/^8[4-7]\d{7}$/.test(formattedPhone)) {
      formattedPhone = '258' + formattedPhone;
      console.log(`[mpesaC2B] Número formatado: ${formattedPhone}`);
    } else {
      return { status: 'error', message: 'Número inválido. Use 84/85 + 7 dígitos' };
    }

    // === REFERÊNCIA ÚNICA (OBRIGATÓRIO NO WEBHOOK) ===
    const reference = customReference || `RPA${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const transactionRef = this.generateCode(); // ← 10 caracteres, funciona no sandbox

    const payload = {
      input_TransactionReference: transactionRef,
      input_CustomerMSISDN: formattedPhone,
      input_Amount: amount.toString(),
      input_ThirdPartyReference: reference,        // ← ÚNICO PARA O WEBHOOK!
      input_ServiceProviderCode: '000000',         // ← SANDBOX MZ = 000000
    };

    console.log('[mpesaC2B] Payload enviado:', payload);

    try {
      const token = this.generateBearerToken(config.apiKey, config.publicKey);

      const response = await axios.post(
        'https://api.sandbox.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Origin': 'developer.mpesa.vm.co.mz',
          },
          timeout: 30000
        }
      );

      console.log('[mpesaC2B] Resposta da API:', response.data);

      // Sandbox aceita → devolve INS-0
      if (response.data.output_ResponseCode === 'INS-0') {
        return {
          status: 'pending',           // ← AGORA CORRETO PARA O TEU ROUTES
          reference: reference,
          transactionId: response.data.output_ConversationID,
          message: 'Pagamento iniciado. Confirme no seu telemóvel.',
          raw: response.data
        };
      }

      return { status: 'error', message: response.data.output_ResponseDesc };

    } catch (error) {
      const err = error.response?.data || error.message;
      console.error('[mpesaC2B] Erro na API:', err);
      return { status: 'error', message: 'Erro na comunicação com M-Pesa' };
    }
  }
}

module.exports = new mpesaC2B();