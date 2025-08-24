const axios = require('axios');
const config = require('./config');

class emolaB2C {
  async payment(phone, amount) {
    const transactionCode = Date.now().toString();
    const payload = {
      customer_number: phone,
      amount,
      transaction_reference: transactionCode,
      third_party_reference: 'RpaLive'
    };

    try {
      const response = await axios.post(
        `${config.baseUrl}/payments/emola/b2c`,
        payload,
        {
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
          }
        }
      );

      return { status: 'success', data: response.data };
    } catch (error) {
      return { status: 'error', message: error.response?.data || error.message };
    }
  }
}

module.exports = new emolaB2C();
