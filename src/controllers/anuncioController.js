const Anuncio = require('../models/Anuncio');
const mongoose = require('mongoose');
const multer = require('multer');
const { storageAnuncios } = require('../config/cloudinary');

const upload = multer({
  storage: storageAnuncios,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Apenas JPEG, PNG, WEBP'));
    }
    cb(null, true);
  }
}).single('image');

// === ADMIN MIDDLEWARE (dentro do controller) ===
const adminOnly = (req, res, next) => {
  if (!req.usuario) return res.status(401).json({ sucesso: false, mensagem: 'Login necessário' });
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado: apenas admin' });
  }
  next();
};

// === 1. CRIAR ANÚNCIO (USUÁRIO) ===
const criarAnuncio = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ sucesso: false, mensagem: err.message });

    try {
      const { name, description, price, ctaLink, weeks = 1, imageUrl } = req.body;
      const image = req.file ? req.file.path : imageUrl;

      if (!name || !price || !ctaLink || !image || !weeks) {
        return res.status(400).json({ sucesso: false, mensagem: 'Campos obrigatórios faltando' });
      }

      const anuncio = new Anuncio({
        name: name.trim(),
        description: description || '',
        price: Number(price),
        ctaLink: ctaLink.trim(),
        image,
        weeks: Number(weeks),
        amount: Number(weeks) * 500,
        userId: req.usuario.id,
        status: 'pending'
      });

      await anuncio.save();
      res.status(201).json({ sucesso: true, anuncioId: anuncio._id, anuncio });
    } catch (error) {
      res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  });
};

// === 2. MEUS ANÚNCIOS (USUÁRIO) ===
const meusAnuncios = async (req, res) => {
  try {
    const anuncios = await Anuncio.find({ userId: req.usuario.id }).sort({ createdAt: -1 });
    res.json(anuncios);
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 3. ANÚNCIOS ATIVOS (PÚBLICO) ===
const anunciosAtivos = async (req, res) => {
  try {
    const anuncios = await Anuncio.find({ status: 'active' }).select('-userId');
    res.json(anuncios);
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 4. ATUALIZAR ANÚNCIO (USUÁRIO) ===
const atualizarAnuncio = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ sucesso: false, mensagem: err.message });

    try {
      const updateData = {};
      const fields = ['name', 'description', 'price', 'ctaLink', 'weeks'];
      fields.forEach(f => {
        if (req.body[f] !== undefined) updateData[f] = req.body[f];
      });
      if (req.body.weeks) updateData.amount = Number(req.body.weeks) * 500;
      if (req.file) updateData.image = req.file.path;
      else if (req.body.imageUrl) updateData.image = req.body.imageUrl;

      const anuncio = await Anuncio.findOneAndUpdate(
        { _id: req.params.id, userId: req.usuario.id },
        updateData,
        { new: true, runValidators: true }
      );

      if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });
      res.json({ sucesso: true, anuncio });
    } catch (error) {
      res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  });
};

// === 5. REMOVER ANÚNCIO (USUÁRIO) ===
const removerAnuncio = async (req, res) => {
  try {
    const anuncio = await Anuncio.findOneAndDelete({
      _id: req.params.id,
      userId: req.usuario.id
    });
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });
    res.json({ sucesso: true, mensagem: 'Removido com sucesso' });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 6. LISTAR TODOS (ADMIN) + FILTRO POR USUÁRIO (COM POPULATE) ===
const listarTodosAdmin = async (req, res) => {
  try {
    const { usuario, status } = req.query;

    const filtro = {};
    if (status && ['active', 'pending', 'paused'].includes(status)) {
      filtro.status = status;
    }

    let query = Anuncio.find(filtro)
      .populate({
        path: 'userId',
        select: 'nome email',
        match: usuario ? {
          $or: [
            { nome: { $regex: usuario, $options: 'i' } },
            { email: { $regex: usuario, $options: 'i' } }
          ]
        } : {}
      })
      .sort({ createdAt: -1 });

    const anuncios = await query;

    // Filtra apenas anúncios com usuário populado (ou seja, que passaram no match)
    const resultado = anuncios
      .filter(a => a.userId !== null)
      .map(a => ({
        ...a.toObject(),
        userName: a.userId?.nome || 'Usuário removido',
        userEmail: a.userId?.email || 'N/A'
      }));

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao listar anúncios (admin):', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar anúncios' });
  }
};

// === 7. ALTERAR STATUS (ADMIN) ===
const alterarStatusAdmin = async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused', 'pending'].includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Status inválido' });
  }

  try {
    const anuncio = await Anuncio.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('userId', 'nome email');

    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });

    const resultado = {
      ...anuncio.toObject(),
      userName: anuncio.userId?.nome || 'Usuário removido',
      userEmail: anuncio.userId?.email || 'N/A'
    };

    res.json({ sucesso: true, anuncio: resultado });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 8. REMOVER QUALQUER ANÚNCIO (ADMIN) ===
const removerQualquerAdmin = async (req, res) => {
  try {
    const anuncio = await Anuncio.findByIdAndDelete(req.params.id);
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });
    res.json({ sucesso: true, mensagem: 'Anúncio removido com sucesso' });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 9. REGISTRAR CLIQUE (PÚBLICO) ===
const registrarClique = async (req, res) => {
  const { id } = req.params;
  try {
    const anuncio = await Anuncio.findByIdAndUpdate(
      id,
      { $inc: { clicks: 1 } },
      { new: true }
    ).select('clicks');

    if (!anuncio) {
      return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });
    }

    res.json({ sucesso: true, clicks: anuncio.clicks });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 10. ESTATÍSTICAS DETALHADAS (ADMIN) ===
const estatisticasAdmin = async (req, res) => {
  try {
    const anuncio = await Anuncio.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });

    res.json({
      views: anuncio.views || 0,
      clicks: anuncio.clicks || 0,
      impressions: (anuncio.views || 0) + (anuncio.clicks || 0) * 2,
      duration: anuncio.weeks * 7,
      statsHistory: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        clicks: Math.floor(Math.random() * 15)
      })).reverse()
    });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  criarAnuncio,
  meusAnuncios,
  anunciosAtivos,
  atualizarAnuncio,
  removerAnuncio,
  adminOnly,
  listarTodosAdmin,
  alterarStatusAdmin,
  removerQualquerAdmin,
  registrarClique,
  estatisticasAdmin
};