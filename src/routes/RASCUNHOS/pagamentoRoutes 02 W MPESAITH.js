const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Gateway = require('../services/getway');


// Rota POST para processar pagamento
router.post('/processar', verificarToken, async (req, res) => {
  const { method, phone, amount, type, pacote, dadosCartao } = req.body;
  const usuarioId = req.usuario.id;

  console.log(`Recebendo solicitação de pagamento para o usuário ${usuarioId}`);

  if (!pacote || !method || !amount) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Pacote, método e valor são obrigatórios.',
    });
  }

  if ((method.toLowerCase() === 'mpesa' || method.toLowerCase() === 'emola') && !phone) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Telefone ausente para pagamento via ${method}.`,
    });
  }

  try {
    // Removeu STK Push e trata tudo via Gateway.payment
    const pay = await Gateway.payment(method.toLowerCase(), phone, amount, type.toLowerCase());
    console.log('Resposta do Gateway:', pay);

    if (pay.status !== 'success') {
      return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou', detalhes: pay });
    }

 const novoPagamento = new Pagamento({
  pacote,
  metodoPagamento: method,
  valor: amount,           // corrigido aqui
  telefone: phone || null,
  dadosCartao: dadosCartao || null,
  status: 'aprovado',
  usuarioId: usuarioId,    // corrigido aqui
  tipoPagamento: type.toLowerCase(),
  dataPagamento: new Date(),
  gatewayResponse: pay.data || null,
});


    const pagamentoSalvo = await novoPagamento.save();

    console.log('Pagamento realizado com sucesso e salvo no DB.');

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Pagamento realizado com sucesso.',
      pagamento: pagamentoSalvo,
    });

  } catch (error) {
    console.error('Erro geral ao processar pagamento:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
});


// Rota para receber callback da M-Pesa


module.exports = router;
