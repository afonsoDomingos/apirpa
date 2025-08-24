const express = require('express');
const router = express.Router();

// C2B - Cliente para Empresa
router.post('/c2b', (req, res) => {
  const { amount, from, reference } = req.body;

  console.log('Simulação de pagamento C2B recebido:', { amount, from, reference });

  res.json({
    status: 'success',
    message: 'Pagamento simulado recebido com sucesso',
    data: {
      amount,
      from,
      reference,
      transactionId: 'SIM123456789'
    }
  });
});

// B2C - Empresa para Cliente
router.post('/b2c', (req, res) => {
  const { amount, to, reference } = req.body;

  console.log('Simulação de pagamento B2C enviado:', { amount, to, reference });

  res.json({
    status: 'success',
    message: 'Pagamento simulado enviado com sucesso',
    data: {
      amount,
      to,
      reference,
      transactionId: 'SIM987654321'
    }
  });
});

module.exports = router;
