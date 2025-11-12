// routes/pagamentoRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');
const Gateway = require('../services/gateway');
const mongoose = require('mongoose');

// === PREÇOS FIXOS (em MZN) ===
const PRECO_TESTE = 25;
const PRECO_MENSAL = 150;
const PRECO_ANUAL = 1500;
const PRECO_POR_SEMANA = 500;

// === VALIDADE EM DIAS ===
const DIAS_TESTE = 5;
const DIAS_MENSAL = 30;
const DIAS_ANUAL = 365;

// Função reutilizável: calcular validade
const calcularValidade = (pag, hoje = new Date()) => {
  const p = (pag.pacote || '').toLowerCase().trim();
  let validade = new Date(pag.dataPagamento);

  if (p === 'teste') {
    validade.setDate(validade.getDate() + DIAS_TESTE);
  } else if (p === 'mensal') {
    validade.setDate(validade.getDate() + DIAS_MENSAL);
  } else if (p === 'anual') {
    validade.setDate(validade.getDate() + DIAS_ANUAL);
  } else if (p === 'anuncio' && pag.anuncioId) {
    const weeks = Number(pag.anuncioId.weeks) || 1;
    validade.setDate(validade.getDate() + weeks * 7);
  }

  const diffMs = validade - hoje;
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const expirado = diffMs < 0;

  return { 
    validade, 
    diasRestantes: expirado ? 0 : diasRestantes, 
    expirado 
  };
};

// ==============================================================
// 1. PROCESSAR PAGAMENTO
// ==============================================================
router.post('/processar', verificarToken, async (req, res) => {
  let { method, phone, amount, type, pacote, anuncioId } = req.body;
  const usuarioId = req.usuario.id;

  // VALIDAÇÕES
  if (!method || amount === undefined || !type) {
    return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos.' });
  }

  amount = parseInt(amount, 10);
  if (isNaN(amount) || amount < 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido.' });
  }

  // TELEFONE (só para métodos pagos)
  if (method !== 'teste' && !phone) {
    return res.status(400).json({ sucesso: false, mensagem: 'Telefone obrigatório.' });
  }

  if (phone) {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const isValid = /^(84|85|86|87)\d{7}$/.test(cleaned) || /^258\d{9}$/.test(cleaned);
    if (!isValid) {
      return res.status(400).json({ sucesso: false, mensagem: 'Telefone inválido. Use 84XXXXXXXXX ou 25884XXXXXXXXX' });
    }
    phone = cleaned.replace(/^258/, '');
  }

  try {
    const referenciaUnica = `RpaLive${Date.now()}${Math.floor(Math.random() * 10000)}`;

    // === ANÚNCIO ===
    if (anuncioId) {
      if (!mongoose.Types.ObjectId.isValid(anuncioId)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do anúncio inválido.' });
      }

      const anuncio = await Anuncio.findOne({ _id: anuncioId, userId: usuarioId });
      if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado.' });

      const weeks = Number(anuncio.weeks) || 1;
      const valorEsperado = weeks * PRECO_POR_SEMANA;

      if (amount !== valorEsperado) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser ${valorEsperado} MZN para ${weeks} semana(s).`
        });
      }

      let pay;
      if (method !== 'teste') {
        for (let tentativa = 1; tentativa <= 5; tentativa++) {
          try {
            console.time(`[Gateway] Tentativa ${tentativa}`);
            pay = await Gateway.payment(method, phone, amount, type, referenciaUnica);
            console.timeEnd(`[Gateway] Tentativa ${tentativa}`);
            if (pay && pay.status === 'success') break;
            if (tentativa < 5) await new Promise(r => setTimeout(r, 5000));
          } catch (err) {
            console.error(`[Gateway] Tentativa ${tentativa} falhou:`, err.message);
            if (tentativa === 5) throw err;
            await new Promise(r => setTimeout(r, 5000));
          }
        }
        if (!pay || pay.status !== 'success') {
          return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou. Tente novamente.' });
        }
      }

      anuncio.status = 'active';
      await anuncio.save();

      const pagamento = new Pagamento({
        usuarioId,
        pacote: 'anuncio',
        metodoPagamento: method,
        valor: amount,
        telefone: phone,
        status: 'aprovado',
        tipoPagamento: 'anuncio',
        dataPagamento: new Date(),
        gatewayResponse: pay ? { ...pay.data, reference: referenciaUnica } : { message: 'Ativado (teste)' },
        anuncioId: anuncio._id
      });
      await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Anúncio ativado com sucesso!',
        validadeDias: weeks * 7
      });
    }

    // === ASSINATURA ===
    if (!pacote || !['teste', 'mensal', 'anual'].includes(pacote.toLowerCase())) {
      return res.status(400).json({ sucesso: false, mensagem: 'Pacote inválido. Use: teste, mensal ou anual.' });
    }

    const pacotes = {
      teste: { preco: PRECO_TESTE, dias: DIAS_TESTE },
      mensal: { preco: PRECO_MENSAL, dias: DIAS_MENSAL },
      anual: { preco: PRECO_ANUAL, dias: DIAS_ANUAL }
    };
    const config = pacotes[pacote.toLowerCase()];

    if (amount !== config.preco) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Valor deve ser ${config.preco} MZN para o pacote ${pacote}.`
      });
    }

    // PLANO TESTE: ativa sem gateway
    if (pacote.toLowerCase() === 'teste') {
      const pagamento = new Pagamento({
        usuarioId,
        pacote: 'teste',
        metodoPagamento: 'teste',
        valor: 25,
        telefone: null,
        status: 'aprovado',
        tipoPagamento: 'assinatura',
        dataPagamento: new Date(),
        gatewayResponse: { message: 'Plano de teste ativado (5 dias)' },
        anuncioId: null
      });
      await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Plano de teste ativado por 5 dias!',
        validadeDias: 5,
        expiraEm: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      });
    }

    // PAGOS: usa gateway
    let pay;
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      try {
        console.time(`[Gateway] Tentativa ${tentativa}`);
        pay = await Gateway.payment(method, phone, amount, type, referenciaUnica);
        console.timeEnd(`[Gateway] Tentativa ${tentativa}`);
        if (pay && pay.status === 'success') break;
        if (tentativa < 5) await new Promise(r => setTimeout(r, 5000));
      } catch (err) {
        console.error(`[Gateway] Tentativa ${tentativa} falhou:`, err.message);
        if (tentativa === 5) throw err;
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (!pay || pay.status !== 'success') {
      return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou. Tente novamente.' });
    }

    const pagamento = new Pagamento({
      usuarioId,
      pacote: pacote.toLowerCase(),
      metodoPagamento: method,
      valor: amount,
      telefone: phone,
      status: 'aprovado',
      tipoPagamento: 'assinatura',
      dataPagamento: new Date(),
      gatewayResponse: { ...pay.data, reference: referenciaUnica },
      anuncioId: null
    });
    await pagamento.save();

    return res.status(201).json({
      sucesso: true,
      mensagem: `Pacote ${pacote} ativado com sucesso!`,
      validadeDias: config.dias,
      expiraEm: new Date(Date.now() + config.dias * 24 * 60 * 60 * 1000)
    });

  } catch (error) {
    console.error('ERRO NO PAGAMENTO:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno. Tente novamente.',
      erro: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==============================================================
// 2. LISTAR MEUS PAGAMENTOS
// ==============================================================
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const pagamentos = await Pagamento.find({ usuarioId: req.usuario.id })
      .sort({ dataPagamento: -1 })
      .populate({
        path: 'anuncioId',
        select: 'name image status weeks',
        match: { _id: { $exists: true } }
      })
      .limit(50);

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      const { validade, diasRestantes, expirado } = calcularValidade(pag, hoje);

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status: expirado ? 'expirado' : 'ativo',
        tipo: pag.anuncioId ? 'anuncio' : 'assinatura',
        anuncio: pag.anuncioId ? {
          id: pag.anuncioId._id,
          name: pag.anuncioId.name,
          image: pag.anuncioId.image,
          status: pag.anuncioId.status,
          weeks: pag.anuncioId.weeks
        } : null
      };
    });

    res.json({ sucesso: true, total: lista.length, pagamentos: lista });
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar pagamentos." });
  }
});

// ==============================================================
// 3. ADMIN: LISTAR TODOS
// ==============================================================
router.get("/", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamentos = await Pagamento.find()
      .populate("usuarioId", "nome email")
      .populate({
        path: 'anuncioId',
        select: 'name image status weeks',
        match: { _id: { $exists: true } }
      })
      .sort({ dataPagamento: -1 })
      .limit(100);

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      const { validade, diasRestantes, expirado } = calcularValidade(pag, hoje);

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status: expirado ? "expirado" : "ativo",
        tipo: pag.anuncioId ? 'anuncio' : 'assinatura',
        usuario: pag.usuarioId ? { nome: pag.usuarioId.nome, email: pag.usuarioId.email } : null,
        anuncio: pag.anuncioId ? {
          id: pag.anuncioId._id,
          name: pag.anuncioId.name,
          image: pag.anuncioId.image,
          status: pag.anuncioId.status,
          weeks: pag.anuncioId.weeks
        } : null
      };
    });

    res.json({ sucesso: true, total: lista.length, pagamentos: lista });
  } catch (error) {
    console.error("Erro ADMIN ao buscar pagamentos:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar pagamentos." });
  }
});

// ==============================================================
// 4. BUSCAR POR ID
// ==============================================================
router.get("/:id", verificarToken, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
  }

  try {
    const pagamento = await Pagamento.findById(req.params.id)
      .populate('anuncioId', 'name image status weeks')
      .populate('usuarioId', 'nome email');

    if (!pagamento) return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });

    if (pagamento.usuarioId.toString() !== req.usuario.id && req.usuario.role !== "admin") {
      return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
    }

    res.json({ sucesso: true, pagamento: pagamento.toObject() });
  } catch (error) {
    console.error("Erro ao buscar pagamento por ID:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar pagamento." });
  }
});

// ==============================================================
// 5. EXCLUIR (ADMIN)
// ==============================================================
router.delete("/:id", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ sucesso: false, mensagem: "ID inválido." });
  }

  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });

    if (pagamento.anuncioId) {
      await Anuncio.findByIdAndUpdate(pagamento.anuncioId, { status: 'paused' });
    }

    await Pagamento.findByIdAndDelete(req.params.id);
    res.json({ sucesso: true, mensagem: "Pagamento removido com sucesso." });
  } catch (error) {
    console.error("Erro ao remover pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao remover pagamento." });
  }
});

// ==============================================================
// 6. VERIFICAR ASSINATURA ATIVA
// ==============================================================
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const ultimo = await Pagamento.findOne({
      usuarioId: req.usuario.id,
      pacote: { $in: ['teste', 'mensal', 'anual'] },
      status: 'aprovado'
    }).sort({ dataPagamento: -1 });

    if (!ultimo) {
      return res.json({ ativa: false, diasRestantes: 0, pacote: null });
    }

    const { validade, diasRestantes, expirado } = calcularValidade(ultimo);

    res.json({
      ativa: !expirado,
      diasRestantes,
      pacote: ultimo.pacote,
      expiraEm: validade
    });
  } catch (error) {
    console.error("Erro ao verificar assinatura ativa:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar assinatura." });
  }
});

module.exports = router;