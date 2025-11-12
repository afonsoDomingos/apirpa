// routes/pagamentoRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');
const Gateway = require('../services/gateway');

// === PREÇOS FIXOS (em MZN) ===
const PRECO_POR_SEMANA = 500;
const PRECO_MENSAL = 150;
const PRECO_ANUAL = 1500;

// ==============================================================
// 1. PROCESSAR PAGAMENTO (ANTIGO + ANÚNCIOS + GRATUITO)
// ==============================================================
router.post('/processar', verificarToken, async (req, res) => {
  let { method, phone, amount, type, pacote, dadosCartao, anuncioId } = req.body;
  const usuarioId = req.usuario.id;

  // Validação obrigatória
  if (!method || amount === undefined) {
    return res.status(400).json({ sucesso: false, mensagem: 'Método e valor são obrigatórios.' });
  }

  amount = Number(amount);
  if (isNaN(amount) || amount < 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido.' });
  }

  try {
    // ==========================================================
    // A) PAGAMENTO DE ANÚNCIO (com anuncioId)
    // ==========================================================
    if (anuncioId) {
      const anuncio = await Anuncio.findOne({ _id: anuncioId, userId: usuarioId });
      if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado.' });

      const weeks = Number(anuncio.weeks) || 0;
      if (weeks <= 0) return res.status(400).json({ sucesso: false, mensagem: 'Número de semanas inválido.' });

      const valorEsperado = weeks * PRECO_POR_SEMANA;

      // --- GRATUITO: 10 MINUTOS (1 vez por anúncio) ---
      if (amount === 0 && method === 'gratuito' && (!pacote || pacote === 'free')) {
        const jaUsou = await Pagamento.countDocuments({
          anuncioId: anuncio._id,
          pacote: 'free',
          metodoPagamento: 'gratuito'
        });

        if (jaUsou > 0) {
          return res.status(400).json({ sucesso: false, mensagem: 'Já ativaste o período grátis deste anúncio.' });
        }

        anuncio.status = 'active';
        await anuncio.save();

        const pagamento = new Pagamento({
          usuarioId,
          pacote: 'free',
          metodoPagamento: 'gratuito',
          valor: 0,
          telefone: null,
          dadosCartao: null,
          status: 'aprovado',
          tipoPagamento: 'anuncio',
          dataPagamento: new Date(),
          gatewayResponse: { message: 'Grátis por 10 minutos' },
          anuncioId: anuncio._id
        });

        const salvo = await pagamento.save();

        return res.status(201).json({
          sucesso: true,
          mensagem: 'Anúncio ativado GRATUITAMENTE por 10 minutos!',
          pagamento: salvo,
          anuncio,
          expiraEm: new Date(Date.now() + 10 * 60 * 1000)
        });
      }

      // --- ANÚNCIO PAGO ---
      if (amount !== valorEsperado) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser exatamente ${valorEsperado} MZN (${weeks} semana${weeks > 1 ? 's' : ''}).`
        });
      }

      const pay = await Gateway.payment(method, phone, amount, type);
      if (!pay || pay.status !== 'success') {
        return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou', detalhes: pay });
      }

      anuncio.status = 'active';
      anuncio.amount = amount;
      await anuncio.save();

      const pagamento = new Pagamento({
        usuarioId,
        pacote: 'anuncio',
        metodoPagamento: method,
        valor: amount,
        telefone: phone || null,
        dadosCartao: null,
        status: 'aprovado',
        tipoPagamento: 'anuncio',
        dataPagamento: new Date(),
        gatewayResponse: pay.data || null,
        anuncioId: anuncio._id
      });

      const salvo = await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Anúncio pago e ativado com sucesso!',
        pagamento: salvo,
        anuncio,
        validadeDias: weeks * 7
      });
    }

    // ==========================================================
    // B) ASSINATURAS ANTIGAS (sem anuncioId)
    // ==========================================================
    if (!pacote) {
      return res.status(400).json({ sucesso: false, mensagem: 'Pacote é obrigatório para assinaturas.' });
    }

    pacote = pacote.toLowerCase().trim();

    // --- PLANO GRATUITO ANTIGO (30 dias) ---
    if (amount === 0 && method === 'gratuito' && pacote === 'free') {
      const pagamento = new Pagamento({
        usuarioId,
        pacote: 'free',
        metodoPagamento: 'gratuito',
        valor: 0,
        telefone: null,
        dadosCartao: null,
        status: 'aprovado',
        tipoPagamento: 'assinatura',
        dataPagamento: new Date(),
        gatewayResponse: { message: 'Plano gratuito ativado (30 dias)' },
        anuncioId: null
      });

      const salvo = await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Plano gratuito (30 dias) ativado com sucesso.',
        pagamento: salvo
      });
    }

    // --- PLANOS PAGOS: mensal ou anual ---
    if (['mensal', 'anual'].includes(pacote)) {
      const valores = { mensal: PRECO_MENSAL, anual: PRECO_ANUAL };
      if (amount !== valores[pacote]) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Valor deve ser ${valores[pacote]} MZN para o plano ${pacote}.`
        });
      }

      const pay = await Gateway.payment(method, phone, amount, type);
      if (!pay || pay.status !== 'success') {
        return res.status(400).json({ sucesso: false, mensagem: 'Falha no pagamento', detalhes: pay });
      }

      const pagamento = new Pagamento({
        usuarioId,
        pacote,
        metodoPagamento: method,
        valor: amount,
        telefone: phone || null,
        dadosCartao: null,
        status: 'aprovado',
        tipoPagamento: 'assinatura',
        dataPagamento: new Date(),
        gatewayResponse: pay.data || null,
        anuncioId: null
      });

      const salvo = await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: `Plano ${pacote} ativado com sucesso!`,
        pagamento: salvo,
        validadeDias: pacote === 'anual' ? 365 : 30
      });
    }

    return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos ou combinação não suportada.' });

  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
});

// ==============================================================
// 2. LISTAR PAGAMENTOS DO USUÁRIO LOGADO
// ==============================================================
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const pagamentos = await Pagamento.find({ usuarioId: req.usuario.id })
      .sort({ dataPagamento: -1 })
      .populate('anuncioId', 'name image status weeks userId');

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      const p = (pag.pacote || '').toLowerCase().trim();
      let validade = new Date(pag.dataPagamento);

      if (p === 'free' && pag.anuncioId) {
        validade.setMinutes(validade.getMinutes() + 10); // anúncio grátis
      } else if (p === 'free') {
        validade.setDate(validade.getDate() + 30); // plano free antigo
      } else if (p === 'anual') {
        validade.setDate(validade.getDate() + 365);
      } else if (p === 'mensal') {
        validade.setDate(validade.getDate() + 30);
      } else if (p === 'anuncio') {
        const weeks = Number(pag.anuncioId?.weeks) || 1;
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
// 3. ADMIN: LISTAR TODOS OS PAGAMENTOS
// ==============================================================
router.get("/", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamentos = await Pagamento.find()
      .populate("usuarioId", "nome email")
      .populate('anuncioId', 'name image status weeks')
      .sort({ dataPagamento: -1 });

    const hoje = new Date();
    const lista = pagamentos.map(pag => {
      const p = (pag.pacote || '').toLowerCase().trim();
      let validade = new Date(pag.dataPagamento);

      if (p === 'free' && pag.anuncioId) validade.setMinutes(validade.getMinutes() + 10);
      else if (p === 'free') validade.setDate(validade.getDate() + 30);
      else if (p === 'anual') validade.setDate(validade.getDate() + 365);
      else if (p === 'mensal') validade.setDate(validade.getDate() + 30);
      else if (p === 'anuncio') {
        const weeks = Number(pag.anuncioId?.weeks) || 1;
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
// 4. BUSCAR PAGAMENTO POR ID (dono ou admin)
// ==============================================================
router.get("/:id", verificarToken, async (req, res) => {
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
// 5. EXCLUIR PAGAMENTO (ADMIN)
// ==============================================================
router.delete("/:id", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });

    // Se for anúncio, pausar
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
// 6. VERIFICAR ASSINATURA ATIVA (APENAS mensal/anual)
// ==============================================================
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const ultimo = await Pagamento.findOne({
      usuarioId: req.usuario.id,
      pacote: { $in: ['mensal', 'anual'] },
      status: 'aprovado'
    }).sort({ dataPagamento: -1 });

    if (!ultimo) {
      return res.json({ ativa: false, diasRestantes: 0, pacote: null });
    }

    const dias = ultimo.pacote === 'anual' ? 365 : 30;
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
// 7. WEBHOOK (M-Pesa, Emola, etc)
// ==============================================================
router.post('/webhook', (req, res) => {
  console.log('[WEBHOOK PAGAMENTO] Dados recebidos:', req.body);
  // Aqui podes processar confirmações reais e atualizar status
  res.json({ sucesso: true, recebido: true });
});

module.exports = router;