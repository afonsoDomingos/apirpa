// api/mpesa/mpesaC2B.js
const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

class mpesaC2B {
  // Gera token Bearer criptografado com RSA
  generateBearerToken(apiKey, publicKeyPem) {
    try {
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(apiKey)
      );
      return encrypted.toString('base64');
    } catch (error) {
      console.error('[mpesaC2B] Erro ao gerar token:', error.message);
      throw new Error('Falha na autenticação com M-Pesa');
    }
  }

  // Gera referência única (ex: RPA17394561237890)
  generateUniqueReference() {
    return `RPA${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  // Função principal de pagamento
  async payment(phone, amount, customReference = null) {
    console.log(`[mpesaC2B] Iniciando pagamento: phone=${phone}, amount=${amount}, ref=${customReference}`);

 
    // === VALIDAÇÃO E FORMATAÇÃO DO NÚMERO (FUNCIONA COM 84... ou 25884...) ===
    let formattedPhone = phone.toString().replace(/[^0-9]/g, '');

    // Remove o 258 se já vier com ele
    if (formattedPhone.startsWith('258')) {
      formattedPhone = formattedPhone.substring(3);
    }

    // Agora: tem que ter EXATAMENTE 9 dígitos e começar com 84, 85, 86 ou 87
    if (/^8[4-7]\d{7}$/.test(formattedPhone)) {
      formattedPhone = '258' + formattedPhone;
      console.log(`[mpesaC2B] Número válido → ${formattedPhone}`);
    } else {
      console.error('[mpesaC2B] Número rejeitado:', phone, '| Após limpeza:', formattedPhone);
      return { 
        status: 'error', 
        message: 'Número inválido. Use formato 84XXXXXXX (9 dígitos)' 
      };
    }


    // === REFERÊNCIA ÚNICA ===
    const reference = customReference || this.generateUniqueReference();
    // Garante exatamente 12 dígitos
const transactionRef = '1' + String(Date.now()).slice(-11);
    console.log('[mpesaC2B] TransactionReference gerado:', transactionRef);

    // === PAYLOAD PARA A API ===
    const payload = {
      input_TransactionReference: transactionRef,
      input_CustomerMSISDN: formattedPhone,
      input_Amount: amount.toString(),
      input_ThirdPartyReference: reference, // ← ÚNICO E OBRIGATÓRIO!
      input_ServiceProviderCode: config.serviceProviderCode,
    };

    console.log('[mpesaC2B] Payload enviado:', payload);

    try {
      // === GERA TOKEN ===
      const token = this.generateBearerToken(config.apiKey, config.publicKey);

      // === URL DINÂMICA (sandbox ou produção) ===
      const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://api.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/'
        : 'https://api.sandbox.vm.co.mz:18352/ipg/v1x/c2bPayment/singleStage/';

      // === CHAMADA À API M-PESA ===
      const response = await axios.post(baseUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': 'developer.mpesa.vm.co.mz',
        },
        timeout: 30000
      });

      const data = response.data;
      console.log('[mpesaC2B] Resposta da API:', data);

      // === TODAS AS RESPOSTAS "INS-0" ou "Accepted" = PENDING ===
      if (
        data.output_ResponseCode === 'INS-0' ||
        data.output_ResponseDesc?.includes('Accepted') ||
        data.output_ResponseDesc?.includes('Request')
      ) {
        return {
          status: 'pending', // ← STATUS CORRETO!
          reference: reference,
          transactionId: data.output_TransactionID || data.output_ConversationID,
          message: 'Pagamento iniciado. Confirme no seu telemóvel.',
          raw: data
        };
      }

      // === QUALQUER OUTRO CÓDIGO = ERRO REAL ===
      return {
        status: 'error',
        message: data.output_ResponseDesc || 'Erro desconhecido na API M-Pesa',
        raw: data
      };

    } catch (error) {
      const errMsg = error.response?.data?.output_ResponseDesc || error.message;
      console.error('[mpesaC2B] Erro na requisição:', errMsg);
      return {
        status: 'error',
        message: errMsg
      };
    }
  }
}

module.exports = new mpesaC2B();