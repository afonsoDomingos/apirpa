// controllers/anuncioController.js
const Anuncio = require('../models/Anuncio');
const Pagamento = require('../models/pagamentoModel');
const Gateway = require('../services/gateway');

// CRIAR ANÚNCIO (DRAFT)
const criarAnuncio = async (req, res) => {
  const { name, image } = req.body;
  const userId = req.usuario.id;

  if (!name) {
    return res.status(400).json({ sucesso: false, mensagem: 'Nome é obrigatório.' });
  }

  try {
    const anuncio = new Anuncio({
      name,
      image: image || null,
      userId,
      status: 'draft'
    });

    await anuncio.save();
    res.status(201).json({ sucesso: true, anuncio });
  } catch (error) {
    console.error('Erro ao criar anúncio:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
};

// LISTAR MEUS ANÚNCIOS
const meusAnuncios = async (req, res) => {
  try {
    const hoje = new Date();
    const anuncios = await Anuncio.find({ userId: req.usuario.id })
      .select('name image status weeks startDate endDate amount')
      .sort({ createdAt: -1 });

    const comStatus = anuncios.map(a => {
      const expirado = a.endDate && a.endDate < hoje;
      return {
        ...a._doc,
        status: expirado ? 'expired' : a.status,
        diasRestantes: a.endDate ? Math.ceil((a.endDate - hoje) / 86400000) : null,
        expirado
      };
    });

    res.json({ sucesso: true, anuncios: comStatus });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar.' });
  }
};

// LISTAR ANÚNCIOS ATIVOS (PÚBLICO)
const anunciosAtivos = async (req, res) => {
  try {
    const hoje = new Date();
    const anuncios = await Anuncio.find({
      status: 'active',
      endDate: { $gte: hoje }
    }).select('name image').limit(20);

    res.json({ sucesso: true, anuncios });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar anúncios.' });
  }
};

// ATUALIZAR ANÚNCIO
const atualizarAnuncio = async (req, res) => {
  const { id } = req.params;
  const { name, image } = req.body;

  try {
    const anuncio = await Anuncio.findOne({ _id: id, userId: req.usuario.id });
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });

    if (anuncio.status !== 'draft') {
      return res.status(400).json({ sucesso: false, mensagem: 'Só pode editar em draft.' });
    }

    anuncio.name = name || anuncio.name;
    anuncio.image = image || anuncio.image;
    await anuncio.save();

    res.json({ sucesso: true, anuncio });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar.' });
  }
};

// REMOVER ANÚNCIO
const removerAnuncio = async (req, res) => {
  const { id } = req.params;

  try {
    const anuncio = await Anuncio.findOneAndDelete({ _id: id, userId: req.usuario.id });
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado.' });

    res.json({ sucesso: true, mensagem: 'Anúncio removido.' });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover.' });
  }
};

// PROCESSAR PAGAMENTO (agora chamado via rota específica)
const processarPagamento = async (req, res) => {
  const { method, phone, amount, weeks } = req.body;
  const anuncioId = req.params.id;  // Pega do params agora
  const usuarioId = req.usuario.id;

  if (!method || !amount || !weeks || weeks < 1 || weeks > 4) {
    return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos (método, valor, semanas entre 1-4).' });
  }

  // Validação extra para phone se método requer
  if ((method === 'mpesa' || method === 'emola') && !phone) {
    return res.status(400).json({ sucesso: false, mensagem: `Telefone obrigatório para ${method}.` });
  }

  try {
    const anuncio = await Anuncio.findOne({ _id: anuncioId, userId: usuarioId });
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado.' });

    if (anuncio.status !== 'draft') {
      return res.status(400).json({ sucesso: false, mensagem: 'Anúncio já pago ou expirado.' });
    }

    const precoEsperado = weeks * 500;
    if (Number(amount) !== precoEsperado) {
      return res.status(400).json({ sucesso: false, mensagem: `Valor deve ser ${precoEsperado} MZN.` });
    }

    const hoje = new Date();
    const fim = new Date(hoje);
    fim.setDate(hoje.getDate() + weeks * 7);

    // ATIVAR ANÚNCIO
    anuncio.status = 'active';
    anuncio.weeks = weeks;
    anuncio.startDate = hoje;
    anuncio.endDate = fim;
    anuncio.amount = amount;
    await anuncio.save();

    // GRATUITO
    if (amount == 0 && method === 'gratuito') {
      const pagamento = new Pagamento({
        pacote: 'free',
        metodoPagamento: 'gratuito',
        valor: 0,
        status: 'aprovado',
        usuarioId,
        tipoPagamento: 'anuncio',  // Diferencia como anúncio
        dataPagamento: hoje,
        gatewayResponse: { message: 'Gratuito ativado' },
        anuncioId: anuncio._id
      });
      await pagamento.save();
      return res.json({ sucesso: true, mensagem: 'Anúncio gratuito ativado!', anuncio });
    }

    // PAGAMENTO PAGO
    const pay = await Gateway.payment(method, phone, amount, 'anuncio');
    if (!pay || pay.status !== 'success') {
      return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou', detalhes: pay });
    }

    const pagamento = new Pagamento({
      pacote: `anuncio_${weeks}s`,
      metodoPagamento: method,
      valor: amount,
      telefone: phone,
      status: 'aprovado',
      usuarioId,
      tipoPagamento: 'anuncio',  // Diferencia como anúncio
      dataPagamento: hoje,
      gatewayResponse: pay.data,
      anuncioId: anuncio._id
    });

    await pagamento.save();

    res.json({ sucesso: true, mensagem: 'Anúncio ativado!', anuncio, pagamento });
  } catch (error) {
    console.error('Erro no pagamento:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
};

module.exports = {
  criarAnuncio,
  meusAnuncios,
  anunciosAtivos,
  atualizarAnuncio,
  removerAnuncio,
  processarPagamento
};