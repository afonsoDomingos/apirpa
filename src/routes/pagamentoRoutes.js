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

// ==============================================================
// 1. PROCESSAR PAGAMENTO
// ==============================================================
router.post('/processar', verificarToken, async (req, res) => {
  let { method, phone, amount, type, pacote, dadosCartao, anuncioId } = req.body;
  const usuarioId = req.usuario.id;

  if (!method || amount === undefined || !phone) {
    return res.status(400).json({ sucesso: false, mensagem: 'Método, telefone e valor são obrigatórios.' });
  }

  amount = Number(amount);
  if (isNaN(amount) || amount < 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido.' });
  }

  try {
    const referenciaUnica = `RpaLive${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
    let pay;

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        pay = await Gateway.payment(method, phone, amount, type, referenciaUnica);
        if (pay && pay.status === 'success') break;
        if (tentativa < 3) await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[Gateway] Tentativa ${tentativa} falhou:`, err.message);
        if (tentativa === 3) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!pay || pay.status !== 'success') {
      let mensagemAmigavel = 'Pagamento falhou. Tente novamente.';
      const msg = typeof pay?.message === 'string' ? pay.message.toLowerCase() : '';

      if (msg.includes('saldo') || msg.includes('insuficiente')) mensagemAmigavel = 'Saldo insuficiente na carteira.';
      else if (msg.includes('timeout') || msg.includes('tempo')) mensagemAmigavel = 'Tempo esgotado. Tente novamente.';
      else if (msg.includes('número') || msg.includes('inválido')) mensagemAmigavel = 'Número de telefone inválido.';
      else if (msg.includes('cancelado') || msg.includes('recusado')) mensagemAmigavel = 'Pagamento cancelado.';
      else if (pay?.output_ResponseCode === 'INS-10') mensagemAmigavel = 'Transação duplicada. Tente novamente.';

      return res.status(400).json({
        sucesso: false,
        mensagem: mensagemAmigavel,
        detalhes: pay || { erro: 'Gateway não respondeu' },
        dica: 'Verifique saldo, número e conexão.'
      });
    }

    // === ANÚNCIO ===
    if (anuncioId) {
      if (!mongoose.Types.ObjectId.isValid(anuncioId)) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do anúncio inválido.' });
      }

      const anuncio = await Anuncio.findOne({ _id: anuncioId, userId: usuarioId });
      if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado.' });

      const weeks = Number(anuncio.weeks) || 1;
      const valorEsperado = weeks * PRECO_POR_SEMANA;

      // === ANÚNCIO GRATUITO (10 MIN) ===
      if (amount === 0 && method === 'gratuito') {
        const jaUsou = await Pagamento.findOne({
          anuncioId: anuncio._id,
          pacote: 'free',
          metodoPagamento: 'gratuito'
        });

        if (jaUsou) {
          return res.status(400).json({ sucesso: false, mensagem: 'Já usaste o período grátis neste anúncio.' });
        }

        anuncio.status = 'active';
        await anuncio.save();

        const pagamento = new Pagamento({
          usuarioId,
          pacote: 'free',
          metodoPagamento: 'gratuito',
          valor: 0,
          telefone: null,
          status: 'aprovado',
          tipoPagamento: 'anuncio',
          dataPagamento: new Date(),
          gatewayResponse: { message: 'Grátis 10 min' },
          anuncioId: anuncio._id
        });

        await pagamento.save();

        return res.status(201).json({
          sucesso: true,
          mensagem: 'Anúncio ativado GRATUITAMENTE por 10 minutos!',
          expiraEm: new Date(Date.now() + 10 * 60 * 1000)
        });
      }

      // === ANÚNCIO PAGO ===
      if (amount !== valorEsperado) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser ${valorEsperado} MZN para ${weeks} semana(s).`
        });
      }

      anuncio.status = 'active';
      anuncio.amount = amount;
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
        gatewayResponse: pay.data,
        anuncioId: anuncio._id
      });

      await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Anúncio pago com sucesso!',
        validadeDias: weeks * 7
      });

    } else {
      // === ASSINATURA: teste, mensal, anual ===
      if (!pacote || !['teste', 'mensal', 'anual'].includes(pacote.toLowerCase())) {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: 'Pacote inválido. Use: teste, mensal ou anual.' 
        });
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

      const pagamento = new Pagamento({
        usuarioId,
        pacote: pacote.toLowerCase(),
        metodoPagamento: method,
        valor: amount,
        telefone: phone,
        status: 'aprovado',
        tipoPagamento: 'assinatura',
        dataPagamento: new Date(),
        gatewayResponse: pay.data,
        anuncioId: null
      });

      await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: `Pacote ${pacote} ativado com sucesso!`,
        validadeDias: config.dias,
        expiraEm: new Date(Date.now() + config.dias * 24 * 60 * 60 * 1000)
      });
    }

  } catch (error) {
    console.error('ERRO CRÍTICO NO PAGAMENTO:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno. Tente novamente mais tarde.',
      erro: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==============================================================
// 2. LISTAR PAGAMENTOS DO USUÁRIO
// ==============================================================
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const pagamentos = await Pagamento.find({ usuarioId: req.usuario.id })
      .sort({ dataPagamento: -1 })
      .populate({
        path: 'anuncioId',
        select: 'name image status weeks userId',
        match: { _id: { $exists: true } }
      });

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      const p = (pag.pacote || '').toLowerCase().trim();
      let validade = new Date(pag.dataPagamento);

      if (p === 'free' && pag.anuncioId) {
        validade.setMinutes(validade.getMinutes() + 10);
      } else if (p === 'teste') {
        validade.setDate(validade.getDate() + 5);
      } else if (p === 'mensal') {
        validade.setDate(validade.getDate() + 30);
      } else if (p === 'anual') {
        validade.setDate(validade.getDate() + 365);
      } else if (p === 'anuncio' && pag.anuncioId) {
        const weeks = Number(pag.anuncioId.weeks) || 1;
        validade.setDate(validade.getDate() + weeks * 7);
      }

      const diffMs = validade - hoje;
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const expirado = diasRestantes < 0;

      return {
        ...pag._doc,
        validade,
        diasRestantes: expirado ? 0 : diasRestantes,
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
    console.error("Erro ao buscar meus pagamentos:", error);
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
      .sort({ dataPagamento: -1 });

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      const p = (pag.pacote || '').toLowerCase().trim();
      let validade = new Date(pag.dataPagamento);

      if (p === 'free' && pag.anuncioId) validade.setMinutes(validade.getMinutes() + 10);
      else if (p === 'teste') validade.setDate(validade.getDate() + 5);
      else if (p === 'mensal') validade.setDate(validade.getDate() + 30);
      else if (p === 'anual') validade.setDate(validade.getDate() + 365);
      else if (p === 'anuncio' && pag.anuncioId) {
        const weeks = Number(pag.anuncioId.weeks) || 1;
        validade.setDate(validade.getDate() + weeks * 7);
      }

      const diffMs = validade - hoje;
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const expirado = diasRestantes < 0;

      return {
        ...pag._doc,
        validade,
        diasRestantes: expirado ? 0 : diasRestantes,
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

    const diasPorPacote = {
      teste: 5,
      mensal: 30,
      anual: 365
    };

    const dias = diasPorPacote[ultimo.pacote];
    const validade = new Date(ultimo.dataPagamento);
    validade.setDate(validade.getDate() + dias);

    const hoje = new Date();
    const diffMs = validade - hoje;
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const ativa = diasRestantes >= 0;

    res.json({
      ativa,
      diasRestantes: ativa ? diasRestantes : 0,
      pacote: ultimo.pacote,
      expiraEm: validade
    });
  } catch (error) {
    console.error("Erro ao verificar assinatura ativa:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar assinatura." });
  }
});

// ==============================================================
// 7. WEBHOOK
// ==============================================================
router.post('/webhook', async (req, res) => {
  console.log('[WEBHOOK] Dados recebidos:', req.body);
  const { reference, status } = req.body;

  try {
    const pagamento = await Pagamento.findOne({ 'gatewayResponse.reference': reference });
    if (!pagamento) return res.json({ recebido: true, status: 'ignorado' });

    pagamento.status = status === 'success' ? 'aprovado' : 'rejeitado';
    pagamento.gatewayResponse = { ...pagamento.gatewayResponse, ...req.body };
    await pagamento.save();

    if (pagamento.anuncioId && status === 'success') {
      await Anuncio.findByIdAndUpdate(pagamento.anuncioId, { status: 'active' });
    }

    res.json({ sucesso: true, atualizado: true });
  } catch (err) {
    console.error('Erro no webhook:', err);
    res.status(500).json({ erro: 'falha interna' });
  }
});

module.exports = router;