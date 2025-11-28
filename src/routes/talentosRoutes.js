// routes/talentosRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Talento = require('../models/Talento');
const Gateway = require('../services/gateway');
const mongoose = require('mongoose');

const {
  submeterTalento,
  listarTalentos,
  registrarView,
  meuTalentoHoje
} = require('../controllers/TalentoController');

// Rotas existentes
router.post('/submeter', verificarToken, submeterTalento);
router.get('/lista', listarTalentos);
router.get('/meu', verificarToken, meuTalentoHoje);
router.patch('/view/:id', registrarView);

// NOVA ROTA: PAGAR 10 MT PARA APARECER NO PAINEL
router.post('/pagar/:talentoId', verificarToken, async (req, res) => {
  const { method, phone, type } = req.body; // type = "mpesa" ou "emola"
  const { talentoId } = req.params;
  const usuarioId = req.usuario.id;

  if (!method || !phone || !type) {
    return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos.' });
  }

  if (!mongoose.Types.ObjectId.isValid(talentoId)) {
    return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
  }

  const talento = await Talento.findOne({ _id: talentoId, userId: usuarioId });
  if (!talento) {
    return res.status(404).json({ sucesso: false, mensagem: 'Perfil não encontrado ou não é teu.' });
  }

  if (talento.pago) {
    return res.status(400).json({ sucesso: false, mensagem: 'Já pagaste este perfil hoje!' });
  }

  // VALOR FIXO = 10 MT
  const valor = 10;

  // NOVO (MUDANÇA 1 - ESSA É A MAIS IMPORTANTE):
const referenciaUnica = `TAL${talentoId}${Date.now().toString().slice(-6)}`;


  try {
    let pay;
    for (let i = 1; i <= 5; i++) {
      pay = await Gateway.payment(method, phone, valor, type, referenciaUnica);
      if (pay.status === 'pending' || pay.status === 'success') break;
      if (i < 5) await new Promise(r => setTimeout(r, 5000));
    }

    if (pay.status !== 'pending' && pay.status !== 'success') {
      return res.status(400).json({ sucesso: false, mensagem: pay.message || 'Pagamento falhou.' });
    }

    const isSandboxSuccess = pay.status === 'success';
    

    // Atualiza o talento como pago
    talento.pago = true;
    talento.pagamentoId = null; // opcional: guarda o ID do Pagamento se quiseres
    await talento.save();

    if (isSandboxSuccess) {
        console.log(`[SANDBOX] Talento ATIVADO → ID: ${talentoId} | Nome: ${nome} | Ref: ${referenciaUnica}`);
      // SANDBOX → ativa na hora
      return res.json({
        sucesso: true,
        mensagem: 'Parabéns! Apareces agora no Painel de Talentos!',
        views: talento.views,
        ativoAte: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    // Produção → pendente
    return res.json({
      sucesso: true,
      status: 'pendente',
      mensagem: 'Pagamento iniciado! Confirma no telemóvel. Vais aparecer em minutos.',
      referencia: referenciaUnica
    });

  } catch (error) {
    console.error('Erro pagamento talento:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno. Tenta novamente.' });
  }
});

module.exports = router;