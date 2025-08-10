const mpesaC2B = require('../api/mpesa/mpesaC2B');
const mpesaB2C = require('../api/mpesa/mpesaB2C');
const emolaC2B = require('../api/emola/emolaC2B');
const emolaB2C = require('../api/emola/emolaB2C');

console.log({ mpesaC2B, mpesaB2C, emolaC2B, emolaB2C });  // Verificacao das   importações se funcionaram

class Gateway {
  payment(method, phone, amount, type) {
    console.log(`Gateway.payment called with method=${method}, phone=${phone}, amount=${amount}, type=${type}`);

    const isMpesa = method === 'mpesa';
    const isB2C = type === 'b2c';

    if (isMpesa && isB2C) {
      console.log('Rota escolhida: mpesaB2C.payment');
      return mpesaB2C.payment(phone, amount);
    }

    if (isMpesa && !isB2C) {
      console.log('Rota escolhida: mpesaC2B.payment');
      return mpesaC2B.payment(phone, amount);
    }

    if (!isMpesa && isB2C) {
      console.log('Rota escolhida: emolaB2C.payment');
      return emolaB2C.payment(phone, amount);
    }

    console.log('Rota escolhida: emolaC2B.payment');
    return emolaC2B.payment(phone, amount);
  }
}

module.exports = new Gateway();
