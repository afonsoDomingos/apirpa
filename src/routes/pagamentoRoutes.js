// routes/pagamentoRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');
const Gateway = require('../services/gateway');

// === PREÇOS FIXOS (em meticais) ===
const PRECO_POR_SEMANA = 500;
const PRECO_MENSAL = 150;
const PRECO_ANUAL = 1500;

// === ROTA: PROCESSAR PAGAMENTO (SEM LOGOS) ===
router.post('/processar', verificarToken, async (req, res) => {
  const { method, phone, amount, type, pacote, anuncioId } = req.body;
  const usuarioId = req.usuario.id;

  if (!method || amount === undefined) {
    return res.status(400).json({ sucesso: false, mensagem: 'Método e valor obrigatórios.' });
  }

  if (isNaN(amount) || Number(amount) < 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido.' });
  }

  try {
    // === 1. ANÚNCIO (pago ou gratuito) ===
    if (anuncioId) {
      const anuncio = await Anuncio.findOne({ _id: anuncioId, userId: usuarioId });
      if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado.' });

      const weeks = Number(anuncio.weeks) || 0;
      if (weeks <= 0) return res.status(400).json({ sucesso: false, mensagem: 'Sem semanas definidas.' });

      const valorEsperado = weeks * PRECO_POR_SEMANA;

      // GRATUITO: 10 MINUTOS
      if (amount === 0 && method === 'gratuito' && pacote === 'free') {
        const jaUsou = await Pagamento.countDocuments({ anuncioId: anuncio._id, pacote: 'free' });
        if (jaUsou > 0) return res.status(400).json({ sucesso: false, mensagem: 'Já ativou gratuitamente.' });

        anuncio.status = 'active';
        await anuncio.save();

        const pagamento = new Pagamento({
          pacote: 'free',
          metodoPagamento: 'gratuito',
          valor: 0,
          telefone: null,
          dadosCartao: null,
          status: 'aprovado',
          usuarioId,
          tipoPagamento: 'anuncio',
          dataPagamento: new Date(),
          gatewayResponse: { message: 'Grátis por 10 minutos' },
          anuncioId: anuncio._id
        });

        await pagamento.save();

        return res.status(201).json({
          sucesso: true,
          mensagem: 'Anúncio grátis ativado por 10 minutos!',
          pagamento,
          anuncio,
          expiraEm: new Date(Date.now() + 10 * 60 * 1000)
        });
      }

      // ANÚNCIO PAGO
      if (Number(amount) !== valorEsperado) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser ${valorEsperado} MZN (${weeks} semana${weeks > 1 ? 's' : ''})`
        });
      }

      const pay = await Gateway.payment(method, phone, amount, type);
      if (!pay || pay.status !== 'success') {
        return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou', detalhes: pay });
      }

      anuncio.status = 'active';
      anuncio.amount = amount;
      await anuncio.save();

      const novoPagamento = new Pagamento({
        pacote: 'anuncio',
        metodoPagamento: method,
        valor: amount,
        telefone: phone || null,
        dadosCartao: null,
        status: 'aprovado',
        usuarioId,
        tipoPagamento: 'anuncio',
        dataPagamento: new Date(),
        gatewayResponse: pay.data || null,
        anuncioId: anuncio._id
      });

      const salvo = await novoPagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Anúncio pago ativado!',
        pagamento: salvo,
        anuncio
      });
    }

    // === 2. ASSINATURA (mensal ou anual) ===
    if (['mensal', 'anual'].includes(pacote) && !anuncioId) {
      const valores = { mensal: PRECO_MENSAL, anual: PRECO_ANUAL };
      if (Number(amount) !== valores[pacote]) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser ${valores[pacote]} MZN para plano ${pacote}.`
        });
      }

      const pay = await Gateway.payment(method, phone, amount, type);
      if (!pay || pay.status !== 'success') {
        return res.status(400).json({ sucesso: false, mensagem: 'Falha na assinatura', detalhes: pay });
      }

      const novoPagamento = new Pagamento({
        pacote,
        metodoPagamento: method,
        valor: amount,
        telefone: phone || null,
        dadosCartao: null,
        status: 'aprovado',
        usuarioId,
        tipoPagamento: 'assinatura',
        dataPagamento: new Date(),
        gatewayResponse: pay.data || null,
        anuncioId: null
      });

      const salvo = await novoPagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: `Assinatura ${pacote} ativada!`,
        pagamento: salvo,
        validadeDias: pacote === 'anual' ? 365 : 30
      });
    }

    return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.' });

  } catch (error) {
    console.error('Erro pagamento:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
});

// === LISTAR PAGAMENTOS DO USUÁRIO (SEM LOGOS) ===
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const pagamentos = await Pagamento.find({ usuarioId: req.usuario.id })
      .sort({ dataPagamento: -1 })
      .populate('anuncioId', 'name image status weeks');

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      let validade = new Date(pag.dataPagamento);
      const p = (pag.pacote || '').toLowerCase().trim();

      if (p === 'free') validade.setMinutes(validade.getMinutes() + 10);
      else if (p === 'anual') validade.setDate(validade.getDate() + 365);
      else if (p === 'mensal') validade.setDate(validade.getDate() + 30);
      else if (p === 'anuncio') {
        const w = Number(pag.anuncioId?.weeks) || 1;
        validade.setDate(validade.getDate() + w * 7);
      }

      const diff = validade - hoje;
      const diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const status = diasRestantes < 0 ? 'expirado' : 'ativo';

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status,
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
    console.error("Erro meus pagamentos:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar." });
  }
});

// === ADMIN: LISTAR TODOS (SEM LOGOS) ===
router.get("/", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });

  try {
    const pagamentos = await Pagamento.find()
      .populate("usuarioId", "nome email")
      .populate('anuncioId', 'name image status weeks')
      .sort({ dataPagamento: -1 });

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      let validade = new Date(pag.dataPagamento);
      const p = (pag.pacote || '').toLowerCase().trim();

      if (p === 'free') validade.setMinutes(validade.getMinutes() + 10);
      else if (p === 'anual') validade.setDate(validade.getDate() + 365);
      else if (p === 'mensal') validade.setDate(validade.getDate() + 30);
      else if (p === 'anuncio') {
        const w = Number(pag.anuncioId?.weeks) || 1;
        validade.setDate(validade.getDate() + w * 7);
      }

      const diff = validade - hoje;
      const diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const status = diasRestantes < 0 ? "expirado" : "ativo";

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status,
        tipo: pag.anuncioId ? 'anuncio' : 'assinatura',
        usuario: pag.usuarioId ? { nome: pag.usuarioId.nome, email: pag.usuarioId.email } : null,
        anuncio: pag.anuncioId ? {
          id: pag.anuncioId._id,
          name: pag.anuncioId.name,
          image: pag.anuncioId.image,
          status: pag.anuncioId.status
        } : null
      };
    });

    res.json({ sucesso: true, total: lista.length, pagamentos: lista });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: "Erro ao carregar pagamentos." });
  }
});

// === BUSCAR POR ID (SEM LOGOS) ===
router.get("/:id", verificarToken, async (req, res) => {
  try {
    const pagamento = await Pagamento.findById(req.params.id)
      .populate('anuncioId', 'name image status weeks');

    if (!pagamento) return res.status(404).json({ sucesso: false, mensagem: "Não encontrado." });
    if (pagamento.usuarioId.toString() !== req.usuario.id && req.usuario.role !== "admin") {
      return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
    }

    res.json({
      sucesso: true,
      pagamento: pagamento.toObject()
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar." });
  }
});

// === EXCLUIR (ADMIN) ===
router.delete("/:id", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });

  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) return res.status(404).json({ sucesso: false, mensagem: "Não encontrado." });

    if (pagamento.anuncioId) {
      await Anuncio.findByIdAndUpdate(pagamento.anuncioId, { status: 'paused' });
    }
    await Pagamento.findByIdAndDelete(req.params.id);

    res.json({ sucesso: true, mensagem: "Removido com sucesso." });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: "Erro ao remover." });
  }
});

// === VERIFICAR ASSINATURA ATIVA (SEM LOGO) ===
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const ultimo = await Pagamento.findOne({
      usuarioId: req.usuario.id,
      pacote: { $in: ['mensal', 'anual'] },
      status: 'aprovado'
    }).sort({ dataPagamento: -1 });

    if (!ultimo) return res.json({ ativa: false, diasRestantes: 0 });

    const dias = ultimo.pacote === 'anual' ? 365 : 30;
    const validade = new Date(ultimo.dataPagamento);
    validade.setDate(validade.getDate() + dias);

    const hoje = new Date();
    const diff = validade - hoje;
    const diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const ativa = diasRestantes >= 0;

    res.json({
      ativa,
      diasRestantes: ativa ? diasRestantes : 0,
      pacote: ultimo.pacote,
      expiraEm: validade
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar." });
  }
});


router.post('/webhook', (req, res) => {
  console.log('[M-PESA WEBHOOK] Chegou callback:', req.body);
  res.json({ sucesso: true });
});

module.exports = router;