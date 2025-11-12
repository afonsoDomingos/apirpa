const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');
const Gateway = require('../services/gateway');

// === PREÇOS OFICIAIS (em meticais, sem vírgula) ===
const PRECO_POR_SEMANA = 500;     // 500 MZN por semana
const PRECO_MENSAL = 150;         // 150 MZN
const PRECO_ANUAL = 1500;         // 1500 MZN

// === LOGOS DOS MÉTODOS E PLANOS ===
const LOGOS = {
  metodo: {
    gratuito: 'https://i.imgur.com/8vT0KzP.png',     // ícone grátis
    credit_card: 'https://i.imgur.com/3j8vG7Q.png', // cartão
    pix: 'https://i.imgur.com/2R6zS29.png',         // PIX / M-Pesa
    boleto: 'https://i.imgur.com/5kJ3pLm.png',      // boleto
    mpesa: 'https://i.imgur.com/7xP2mZx.png',       // M-Pesa
    emola: 'https://i.imgur.com/9vR4kLm.png',       // e-Mola
  },
  pacote: {
    free: 'https://i.imgur.com/Qw2xRtY.png',        // grátis
    anuncio: 'https://i.imgur.com/X5vN8pL.png',     // destaque anúncio
    mensal: 'https://i.imgur.com/Z3kL9mW.png',      // coroa mensal
    anual: 'https://i.imgur.com/H7jKp0v.png',       // coroa anual VIP
  }
};

// ROTA: PROCESSAR PAGAMENTO
router.post('/processar', verificarToken, async (req, res) => {
  const { method, phone, amount, type, pacote, dadosCartao, anuncioId } = req.body;
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
          expiraEm: new Date(Date.now() + 10 * 60 * 1000),
          logo: LOGOS.pacote.free,
          metodoLogo: LOGOS.metodo.gratuito
        });
      }

      // ANÚNCIO PAGO
      if (Number(amount) !== valorEsperado) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser ${valorEsperado} MZN (${weeks} semana${weeks > 1 ? 's' : ''})`,
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
        anuncio,
        logo: LOGOS.pacote.anuncio,
        metodoLogo: LOGOS.metodo[method] || LOGOS.metodo.credit_card
      });
    }

    // === 2. ASSINATURA (mensal ou anual) ===
    if (['mensal', 'anual'].includes(pacote) && !anuncioId) {
      const valores = { mensal: PRECO_MENSAL, anual: PRECO_ANUAL };
      if (Number(amount) !== valores[pacote]) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser ${valores[pacote]} MZN para plano ${pacote}.`,
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
        validadeDias: pacote === 'anual' ? 365 : 30,
        logo: LOGOS.pacote[pacote],
        metodoLogo: LOGOS.metodo[method] || LOGOS.metodo.mpesa
      });
    }

    return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.' });

  } catch (error) {
    console.error('Erro pagamento:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
});

// LISTAR PAGAMENTOS DO USUÁRIO
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
        logo: LOGOS.pacote[p] || LOGOS.pacote.anuncio,
        metodoLogo: LOGOS.metodo[pag.metodoPagamento] || LOGOS.metodo.mpesa,
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

// ADMIN: LISTAR TODOS
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
        logo: LOGOS.pacote[p] || LOGOS.pacote.anuncio,
        metodoLogo: LOGOS.metodo[pag.metodoPagamento] || LOGOS.metodo.mpesa,
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
    res.status(500).json({ sucesso: false, mensagem: "Erro admin." });
  }
});

// BUSCAR POR ID
router.get("/:id", verificarToken, async (req, res) => {
  try {
    const pagamento = await Pagamento.findById(req.params.id)
      .populate('anuncioId', 'name image status weeks');

    if (!pagamento) return res.status(404).json({ sucesso: false, mensagem: "Não encontrado." });
    if (pagamento.usuarioId.toString() !== req.usuario.id && req.usuario.role !== "admin") {
      return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
    }

    const p = (pagamento.pacote || '').toLowerCase().trim();
    res.json({
      sucesso: true,
      pagamento: {
        ...pagamento.toObject(),
        logo: LOGOS.pacote[p] || LOGOS.pacote.anuncio,
        metodoLogo: LOGOS.metodo[pagamento.metodoPagamento] || LOGOS.metodo.mpesa
      }
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar." });
  }
});

// EXCLUIR (ADMIN)
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

// VERIFICAR ASSINATURA ATIVA
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const ultimo = await Pagamento.findOne({
      usuarioId: req.usuario.id,
      pacote: { $in: ['mensal', 'anual'] },
      status: 'aprovado'
    }).sort({ dataPagamento: -1 });

    if (!ultimo) return res.json({ ativa: false, diasRestantes: 0, logo: LOGOS.pacote.free });

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
      expiraEm: validade,
      logo: LOGOS.pacote[ultimo.pacote]
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar." });
  }
});

module.exports = router;