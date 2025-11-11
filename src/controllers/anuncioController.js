// controllers/anuncioController.js
const Anuncio = require('../models/Anuncio');
const Pagamento = require('../models/pagamentoModel');
const Gateway = require('../services/gateway');

const criarAnuncio = async (req, res) => {
  const { name, image, description, price, whatsappLink } = req.body;
  const userId = req.usuario.id;

  if (!name) {
    return res.status(400).json({ sucesso: false, mensagem: 'Nome é obrigatório.' });
  }

  try {
    const anuncio = new Anuncio({
      name: name.trim(),
      image: image || null,
      description: description || 'Anúncio no RecuperaAqui – Qualidade garantida!',
      price: price ? Number(price) : 500,
      whatsappLink: whatsappLink || 'https://wa.me/258840000000',
      userId,
      status: 'draft',
      weeks: 0,
      amount: 0
    });

    await anuncio.save();
    res.status(201).json({ sucesso: true, anuncio });
  } catch (error) {
    console.error('Erro ao criar anúncio:', error);
    // Mensagem amigável pro frontend
    res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro ao salvar anúncio. Tente novamente ou contacte o suporte.' 
    });
  }
};

const meusAnuncios = async (req, res) => {
  try {
    const hoje = new Date();
    const anuncios = await Anuncio.find({ userId: req.usuario.id })
      .select('name image description price whatsappLink status weeks startDate endDate amount')
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

const anunciosAtivos = async (req, res) => {
  try {
    const hoje = new Date();
    const anuncios = await Anuncio.find({
      status: 'active',
      endDate: { $gte: hoje }
    })
    .select('name image description price whatsappLink weeks endDate')
    .limit(20)
    .sort({ createdAt: -1 });

    const formatados = anuncios.map(a => ({
      _id: a._id,
      name: a.name,
      image: a.image || '/img/default-ad.jpg',
      description: a.description,
      price: a.price,
      whatsappLink: a.whatsappLink,
      weeks: a.weeks,
      diasRestantes: Math.ceil((a.endDate - hoje) / 86400000)
    }));

    res.json({ sucesso: true, anuncios: formatados });
  } catch (error) {
    console.error('Erro ao carregar anúncios:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar anúncios.' });
  }
};

const processarPagamento = async (req, res) => {
  const { method, phone, amount, weeks, description, price, whatsappLink } = req.body;
  const anuncioId = req.params.id;
  const usuarioId = req.usuario.id;

  if (!method || !amount || !weeks || weeks < 1 || weeks > 4) {
    return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.' });
  }

  try {
    const anuncio = await Anuncio.findOne({ _id: anuncioId, userId: usuarioId });
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado.' });
    if (anuncio.status !== 'draft') return res.status(400).json({ sucesso: false, mensagem: 'Anúncio já pago.' });

    const precoEsperado = weeks * 500;
    if (Number(amount) !== precoEsperado && method !== 'gratuito') {
      return res.status(400).json({ sucesso: false, mensagem: `Valor deve ser ${precoEsperado} MZN.` });
    }

    const hoje = new Date();
    const fim = new Date(hoje);
    fim.setDate(hoje.getDate() + weeks * 7);

    // ATUALIZAR ANÚNCIO
    anuncio.status = 'active';
    anuncio.weeks = weeks;
    anuncio.startDate = hoje;
    anuncio.endDate = fim;
    anuncio.amount = amount;
    anuncio.description = description || anuncio.description;
    anuncio.price = price || amount;
    anuncio.whatsappLink = whatsappLink || anuncio.whatsappLink;
    await anuncio.save();

    // GRATUITO
    if (method === 'gratuito') {
      const pagamento = new Pagamento({
        usuarioId, pacote: 'free_anuncio', metodoPagamento: 'gratuito', valor: 0,
        status: 'aprovado', tipoPagamento: 'anuncio', anuncioId: anuncio._id
      });
      await pagamento.save();
      return res.json({ sucesso: true, mensagem: 'Anúncio gratuito ativado!', anuncio });
    }

    // PAGAMENTO REAL
    const pay = await Gateway.payment(method, phone, amount, 'anuncio');
    if (!pay || pay.status !== 'success') {
      return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou', detalhes: pay });
    }

    const pagamento = new Pagamento({
      usuarioId, pacote: `anuncio_${weeks}s`, metodoPagamento: method, valor: amount,
      telefone: phone, status: 'aprovado', tipoPagamento: 'anuncio',
      anuncioId: anuncio._id, gatewayResponse: pay.data
    });
    await pagamento.save();

    res.json({ sucesso: true, mensagem: 'Anúncio ativado!', anuncio, pagamento });
  } catch (error) {
    console.error('Erro no pagamento:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
};

module.exports = { criarAnuncio, meusAnuncios, anunciosAtivos, processarPagamento };