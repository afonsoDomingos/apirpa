const axios = require('axios');
class sms {

  static async sendSms(phone, message) {
    const payload = {
      from: 'RPA',
      to: '+258' + phone,
      message: message
    };

    try {
      const response = await axios.post('https://api.mozesms.com/message/v2', payload, {
        headers: {
          Authorization: `Bearer ${process.env.SMS_API_TOKEN}`
        }
      });

      return response.data;
    } catch (err) {
      console.error('Erro ao enviar SMS:', err.message);
      return null;
    }
  }
  
}

module.exports = new sms();

