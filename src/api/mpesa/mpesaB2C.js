const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

class mpesaB2C {
  generateBearerToken(apiKey, publicKeyPem) {
    try {
      console.log('[mpesaB2C] Gerando token Bearer...');
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(apiKey)
      );
      const token = encrypted.toString('base64');
      console.log('[mpesaB2C] Token gerado com sucesso');
      return token;
    } catch (error) {
      console.error('[mpesaB2C] Erro ao gerar token:', error.message);
      throw new Error('Erro ao gerar token: ' + error.message);
    }
  }

  generateCode() {
    const timestamp = Date.now().toString().slice(-7); // últimos 7 dígitos do timestamp
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // 3 dígitos aleatórios
    const code = `${timestamp}${randomNum}`; // total 10 caracteres
    console.log('[mpesaB2C] Código gerado para transação:', code);
    return code;
  }

  async payment(phone, amount) {
    console.log(`[mpesaB2C] Iniciando pagamento B2C: phone=${phone}, amount=${amount}`);

    const code = this.generateCode();                 // código único (10 chars)
    const reference = `RpaLive_${code}`;              // referência dinâmica p/ rastreio

    console.log(`[mpesaB2C] Referência gerada: ${reference}`);

    const payload = {
      input_TransactionReference: code,
      input_CustomerMSISDN: phone, // adicione +258 se o gateway exigir
      input_Amount: amount,
      input_ThirdPartyReference: reference,
      input_ServiceProviderCode: config.serviceProviderCode,
    };

    console.log('[mpesaB2C] Payload para API:', payload);

    try {
      const token = this.generateBearerToken(config.apiKey, config.publicKey);

      console.log('[mpesaB2C] Fazendo requisição para API M-Pesa sandbox...');
      const response = await axios.post(
        'https://api.sandbox.vm.co.mz:18352/ipg/v1x/b2cPayment/', // SANDBOX
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            Origin: 'developer.mpesa.vm.co.mz',
          },
        }
      );

      console.log('[mpesaB2C] Resposta da API recebida:', response.data);

      return {
        status: 'success',
        data: response.data,
      };
    } catch (error) {
      console.error('[mpesaB2C] Erro na requisição à API:', error.response?.data || error.message);
      return {
        status: 'error',
        message: error.response?.data || error.message,
      };
    }
  }
}

module.exports = new mpesaB2C();
