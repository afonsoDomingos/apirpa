const sms = require('./services/sms'); // Importa o serviço de SMS
async function testSendSms() {
  const phone = '847877405'; // substitua pelo número de telefone de teste
  const message = 'Teste de envio de SMS usando MozeSMS!';

  const response = await sms.sendSms(phone, message);
  console.log('Resposta do envio de SMS:', response);
}

testSendSms();

//node testSms.js  PARA TESTAR MAIS ANTES TENHO QUE CONFUGURAR A VARIAVEL DE AMBIENT