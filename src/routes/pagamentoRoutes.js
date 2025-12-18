// routes/pagamentoRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');
const Gateway = require('../services/gateway');
const mongoose = require('mongoose');
const { notificarAdmin } = require('../services/notificationService');
const Usuario = require('../models/usuarioModel');

// === PREÇOS FIXOS (em MZN) ===
const PRECO_TESTE = 0;
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
  let validade = new Date(pag.dataPagamento || pag.createdAt || hoje);

  if (p === 'teste') validade.setDate(validade.getDate() + DIAS_TESTE);
  else if (p === 'mensal') validade.setDate(validade.getDate() + DIAS_MENSAL);
  else if (p === 'anual') validade.setDate(validade.getDate() + DIAS_ANUAL);
  else if (p === 'anuncio' && pag.anuncioId) {
    const weeks = Number(pag.anuncioId?.weeks) || 1;
    validade.setDate(validade.getDate() + weeks * 7);
  }

  const diffMs = validade - hoje;
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const expirado = diffMs < 0;

  return { validade, diasRestantes: expirado ? 0 : diasRestantes, expirado };
};

// ==============================================================
// 1. PROCESSAR PAGAMENTO (SANDBOX + PRODUÇÃO 100% FUNCIONAL)
// ==============================================================
router.post('/processar', verificarToken, async (req, res) => {
  let { method, phone, amount, type, pacote, anuncioId, weeks } = req.body;
  const usuarioId = req.usuario.id;

  // VALIDAÇÕES
  if (!method || amount === undefined || !type) {
    return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos.' });
  }

  amount = parseInt(amount, 10);
  if (isNaN(amount) || amount < 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido.' });
  }

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

  const referenciaUnica = `RPA${Date.now()}${Math.floor(Math.random() * 10000)}`;

  try {
    // ====================== ANÚNCIO ======================
    if (anuncioId) {
      if (!mongoose.Types.ObjectId.isValid(anuncioId)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do anúncio inválido.' });
      }

      const anuncio = await Anuncio.findOne({ _id: anuncioId, userId: usuarioId });
      if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado.' });

      const weeksNum = parseInt(weeks, 10);
      if (!weeksNum || weeksNum < 1 || weeksNum > 4) {
        return res.status(400).json({ sucesso: false, mensagem: 'Selecione uma duração válida: 1 a 4 semanas.' });
      }

      const valorEsperado = weeksNum * PRECO_POR_SEMANA;
      if (amount !== valorEsperado) {
        return res.status(400).json({ sucesso: false, mensagem: `Valor deve ser ${valorEsperado} MZN para ${weeksNum} semana(s).` });
      }

      anuncio.weeks = weeksNum;
      anuncio.amount = amount;
      await anuncio.save();

      // TESTE GRÁTIS (anúncio)
      if (method === 'teste') {
        anuncio.status = 'active';
        anuncio.dataAtivacao = new Date();
        anuncio.dataExpiracao = new Date(Date.now() + weeksNum * 7 * 24 * 60 * 60 * 1000);
        await anuncio.save();

        const pagamento = new Pagamento({
          usuarioId, pacote: 'anuncio', metodoPagamento: 'teste', valor: amount, telefone: null,
          status: 'aprovado', tipoPagamento: 'anuncio', dataPagamento: new Date(),
          gatewayResponse: { message: 'Ativado (teste)' }, referencia: referenciaUnica, anuncioId: anuncio._id
        });
        await pagamento.save();

        // 🔔 NOTIFICAÇÃO PUSH PARA ADMIN (Background)
        Usuario.findById(usuarioId).then(user => {
          notificarAdmin({
            title: 'Pagamento de Teste (Anúncio) 🧪',
            body: `${user?.nome || 'Usuário'} ativou um anúncio via Teste.`,
            data: { url: '/admin/pagamentos' }
          }).catch(err => console.error('Erro push background:', err));
        });

        return res.status(201).json({
          sucesso: true, mensagem: 'Anúncio ativado com sucesso!', anuncioId: anuncio._id,
          weeks: weeksNum, validadeDias: weeksNum * 7, dataExpiracao: anuncio.dataExpiracao
        });
      }

      // PAGAMENTO REAL (M-Pesa / e-Mola)
      let pay;
      for (let i = 1; i <= 5; i++) {
        pay = await Gateway.payment(method, phone, amount, type, referenciaUnica);
        if (pay.status === 'pending' || pay.status === 'success') break;
        if (i < 5) await new Promise(r => setTimeout(r, 5000));
      }

      if (pay.status !== 'pending' && pay.status !== 'success') {
        return res.status(400).json({ sucesso: false, mensagem: pay.message || 'Pagamento falhou. Tente novamente.' });
      }

      const isSandboxSuccess = pay.status === 'success'; // ← Só true no sandbox

      const pagamento = new Pagamento({
        usuarioId, pacote: 'anuncio', metodoPagamento: method, valor: amount, telefone: phone,
        status: isSandboxSuccess ? 'aprovado' : 'pendente',
        tipoPagamento: 'anuncio',
        dataPagamento: isSandboxSuccess ? new Date() : null,
        gatewayResponse: pay,
        referencia: referenciaUnica,
        anuncioId: anuncio._id
      });
      await pagamento.save();

      // ATIVA NA HORA NO SANDBOX
      if (isSandboxSuccess) {
        anuncio.status = 'active';
        anuncio.dataAtivacao = new Date();
        anuncio.dataExpiracao = new Date(Date.now() + weeksNum * 7 * 24 * 60 * 60 * 1000);
        await anuncio.save();

        // 🔔 NOTIFICAÇÃO PUSH PARA ADMIN (Background)
        Usuario.findById(usuarioId).then(user => {
          notificarAdmin({
            title: 'Novo Anúncio (Sandbox) 📢',
            body: `${user?.nome || 'Usuário'} pagou ${amount} MZN via ${method}.`,
            data: { url: '/admin/pagamentos' }
          }).catch(err => console.error('Erro push background:', err));
        });

        return res.status(201).json({
          sucesso: true,
          mensagem: 'Anúncio ativado com sucesso! (Sandbox)',
          anuncioId: anuncio._id,
          weeks: weeksNum,
          validadeDias: weeksNum * 7,
          dataExpiracao: anuncio.dataExpiracao
        });
      }

      // Produção → pendente
      return res.json({
        sucesso: true, status: 'pendente',
        mensagem: 'Pagamento iniciado! Confirme no seu telemóvel.',
        referencia: referenciaUnica, tempoEstimado: 'Até 2 minutos'
      });
    }

    // ====================== ASSINATURA ======================
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
      return res.status(400).json({ sucesso: false, mensagem: `Valor deve ser ${config.preco} MZN para o pacote ${pacote}.` });
    }

    // PLANO TESTE GRÁTIS
    if (pacote.toLowerCase() === 'teste') {
      const pagamento = new Pagamento({
        usuarioId, pacote: 'teste', metodoPagamento: 'teste', valor: PRECO_TESTE, telefone: null,
        status: 'aprovado', tipoPagamento: 'assinatura', dataPagamento: new Date(),
        gatewayResponse: { message: 'Plano de teste ativado (5 dias)' }, referencia: referenciaUnica
      });
      await pagamento.save();

      // 🔔 NOTIFICAÇÃO PUSH PARA ADMIN (Background)
      Usuario.findById(usuarioId).then(user => {
        notificarAdmin({
          title: 'Assinatura de Teste 🧪',
          body: `${user?.nome || 'Usuário'} ativou plano Teste.`,
          data: { url: '/admin/pagamentos' }
        }).catch(err => console.error('Erro push background:', err));
      });

      return res.status(201).json({
        sucesso: true, mensagem: 'Plano de teste ativado por 5 dias!',
        validadeDias: 5, expiraEm: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      });
    }

    // PAGAMENTOS REAIS (mensal/anual)
    let pay;
    for (let i = 1; i <= 5; i++) {
      pay = await Gateway.payment(method, phone, amount, type, referenciaUnica);
      if (pay.status === 'pending' || pay.status === 'success') break;
      if (i < 5) await new Promise(r => setTimeout(r, 5000));
    }

    if (pay.status !== 'pending' && pay.status !== 'success') {
      return res.status(400).json({ sucesso: false, mensagem: pay.message || 'Pagamento falhou. Tente novamente.' });
    }

    const isSandboxSuccess = pay.status === 'success';

    const pagamento = new Pagamento({
      usuarioId, pacote: pacote.toLowerCase(), metodoPagamento: method, valor: amount, telefone: phone,
      status: isSandboxSuccess ? 'aprovado' : 'pendente',
      tipoPagamento: 'assinatura',
      dataPagamento: isSandboxSuccess ? new Date() : null,
      gatewayResponse: pay,
      referencia: referenciaUnica
    });
    await pagamento.save();

    if (isSandboxSuccess) {
      // 🔔 NOTIFICAÇÃO PUSH PARA ADMIN (Background)
      Usuario.findById(usuarioId).then(user => {
        notificarAdmin({
          title: 'Nova Assinatura (Sandbox) ✨',
          body: `${user?.nome || 'Usuário'} pagou ${amount} MZN via ${method}.`,
          data: { url: '/admin/pagamentos' }
        }).catch(err => console.error('Erro push background:', err));
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: `Plano ${pacote} ativado com sucesso! (Sandbox)`,
        pacote: pacote.toLowerCase(),
        validadeDias: config.dias,
        expiraEm: new Date(Date.now() + config.dias * 24 * 60 * 60 * 1000)
      });
    }

    return res.json({
      sucesso: true, status: 'pendente',
      mensagem: 'Pagamento iniciado! Confirme no seu telemóvel.',
      referencia: referenciaUnica, pacote: pacote, validadeDias: config.dias
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
      .sort({ dataPagamento: -1, createdAt: -1 })
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
        status: pag.status === 'pendente' ? 'pendente' : (expirado ? 'expirado' : 'ativo'),
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
      .sort({ dataPagamento: -1, createdAt: -1 })
      .limit(100);

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      const { validade, diasRestantes, expirado } = calcularValidade(pag, hoje);

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status: pag.status === 'pendente' ? 'pendente' : (expirado ? "expirado" : "ativo"),
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

    const { validade, diasRestantes, expirado } = calcularValidade(pagamento);
    const resposta = {
      sucesso: true,
      pagamento: {
        ...pagamento.toObject(),
        validade,
        diasRestantes,
        statusAtual: pagamento.status === 'pendente' ? 'pendente' : (expirado ? 'expirado' : 'ativo')
      }
    };

    res.json(resposta);
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