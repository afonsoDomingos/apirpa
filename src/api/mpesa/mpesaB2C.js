const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

class mpesaB2C {
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
      throw new Error('Erro ao gerar token: ' + error.message);
    }
  }

  async payment(phone, amount) {
    const code = Date.now().toString();
    const reference = 'GibraLive';

    const payload = {
      input_TransactionReference: code,
     // input_CustomerMSISDN: `258${phone}`,
      input_CustomerMSISDN: phone,
      input_Amount: amount,
      input_ThirdPartyReference: reference,
      input_ServiceProviderCode: config.serviceProviderCode,
    };

    try {
      const token = this.generateBearerToken(config.apiKey, config.publicKey);
      const response = await axios.post(
        'https://api.vm.co.mz:18345/ipg/v1x/b2cPayment/',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            Origin: 'developer.mpesa.vm.co.mz',
          },
        }
      );
      return {
        status: 'success',
        data: response.data,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.response?.data || error.message,
      };
    }
  }
}

module.exports = new mpesaB2C();
