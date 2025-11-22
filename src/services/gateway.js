// services/gateway.js
const mpesaC2B = require('../api/mpesa/mpesaC2B');
const emolaC2B = require('../api/emola/emolaC2B'); // você já deve ter


class Gateway {
  generateReference() {
    return `RPA${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  async payment(method, phone, amount, type, customRef = null) {
    const reference = customRef || this.generateReference();
    console.log(`[Gateway] Iniciando pagamento: ${method}, ${phone}, ${amount} MZN, ref: ${reference}`);

    if (method === 'mpesa') {
      return await mpesaC2B.payment(phone, amount, reference);
    }
    if (method === 'emola') {
      return await emolaC2B.payment(phone, amount, reference);
    }

    throw new Error('Método de pagamento não suportado: ' + method);
  }
}

module.exports = new Gateway();