const mpesaC2B = require('../api/mpesa/mpesaC2B');
const mpesaB2C = require('../api/mpesa/mpesaB2C');
const emolaC2B = require('../api/emola/emolaC2B');
const emolaB2C = require('../api/emola/emolaB2C');

console.log({ mpesaC2B, mpesaB2C, emolaC2B, emolaB2C });  // Só para debug em desenvolvimento

class Gateway {
  async payment(method, phone, amount, type) {
    console.log(`Gateway.payment called with method=${method}, phone=${phone}, amount=${amount}, type=${type}`);

    const isMpesa = method === 'mpesa';
    const isEmola = method === 'emola';
    const isB2C = type === 'b2c';

    if (isMpesa && isB2C) {
      console.log('Rota escolhida: mpesaB2C.payment');
      return mpesaB2C.payment(phone, amount);
    }

    if (isMpesa && !isB2C) {
      console.log('Rota escolhida: mpesaC2B.payment');
      return mpesaC2B.payment(phone, amount);
    }

    if (isEmola && isB2C) {
      console.log('Rota escolhida: emolaB2C.payment');
      return emolaB2C.payment(phone, amount);
    }

    if (isEmola && !isB2C) {
      console.log('Rota escolhida: emolaC2B.payment');
      return emolaC2B.payment(phone, amount);
    }

    // Caso o método não seja reconhecido
    throw new Error(`Método de pagamento inválido: ${method}`);
  }
}

module.exports = new Gateway();
