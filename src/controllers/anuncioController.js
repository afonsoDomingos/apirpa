// controllers/AnuncioController.js
const Anuncio = require('../models/Anuncio');
const mongoose = require('mongoose');
const multer = require('multer');
const { storageAnuncios } = require('../config/cloudinary');

// === MULTER CONFIG ===
const upload = multer({
  storage: storageAnuncios,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Apenas JPEG, PNG, WEBP'));
    }
    cb(null, true);
  }
}).single('image');

// === ADMIN MIDDLEWARE ===
const adminOnly = (req, res, next) => {
  if (!req.usuario) return res.status(401).json({ sucesso: false, mensagem: 'Login necessário' });
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado: apenas admin' });
  }
  next();
};

// === 1. CRIAR ANÚNCIO ===
const criarAnuncio = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ sucesso: false, mensagem: err.message });

    try {
      const { name, description, price, ctaLink, phone, weeks = 1, imageUrl } = req.body;
      const image = req.file ? req.file.path : imageUrl;

      if (!name || !price || !ctaLink || !image) {
        return res.status(400).json({ sucesso: false, mensagem: 'Campos obrigatórios faltando' });
      }

      const anuncio = new Anuncio({
        name: name.trim(),
        description: description?.trim() || '',
        price: Number(price),
        ctaLink: ctaLink.trim(),
        phone: phone?.trim(),
        image,
        weeks: Number(weeks) || 1,
        userId: req.usuario.id,
        status: 'pending'
      });

      await anuncio.save();

      res.status(201).json({ sucesso: true, anuncioId: anuncio._id, anuncio });
    } catch (error) {
      console.error('Erro ao criar anúncio:', error);
      res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  });
};

// === 2. MEUS ANÚNCIOS ===
const meusAnuncios = async (req, res) => {
  try {
    const anuncios = await Anuncio.find({ userId: req.usuario.id })
      .sort({ createdAt: -1 })
      .select('-clickHistory -__v');
    res.json(anuncios);
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 3. ANÚNCIOS ATIVOS (PÚBLICO) ===
const anunciosAtivos = async (req, res) => {
  try {
    const anuncios = await Anuncio.find({ status: 'active' })
      .select('-userId -clickHistory -__v')
      .sort({ featured: -1, createdAt: -1 });
    res.json(anuncios);
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 4. ATUALIZAR ANÚNCIO ===
const atualizarAnuncio = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ sucesso: false, mensagem: err.message });

    try {
      const updateData = {};
      const fields = ['name', 'description', 'price', 'ctaLink', 'phone', 'weeks'];
      fields.forEach(f => {
        if (req.body[f] !== undefined) updateData[f] = req.body[f];
      });
      if (req.body.weeks) updateData.weeks = Number(req.body.weeks);
      if (req.file) updateData.image = req.file.path;
      else if (req.body.imageUrl) updateData.image = req.body.imageUrl;

      const anuncio = await Anuncio.findOneAndUpdate(
        { _id: req.params.id, userId: req.usuario.id },
        updateData,
        { new: true, runValidators: true }
      ).select('-clickHistory');

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

// === 6. LISTAR TODOS (ADMIN) ===
const listarTodosAdmin = async (req, res) => {
  try {
    const { usuario, status } = req.query;
    const filtro = {};
    if (status && ['active', 'pending', 'paused', 'expired', 'rejected'].includes(status)) {
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
      .sort({ createdAt: -1 })
      .select('-clickHistory -__v');

    const anuncios = await query;
    const resultado = anuncios
      .filter(a => a.userId !== null)
      .map(a => ({
        ...a.toObject(),
        userName: a.userId?.nome || 'Usuário removido',
        userEmail: a.userId?.email || 'N/A'
      }));

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao listar (admin):', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar' });
  }
};

// === 7. ALTERAR STATUS (ADMIN) ===
const alterarStatusAdmin = async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused', 'pending', 'expired', 'rejected'].includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Status inválido' });
  }

  try {
    const anuncio = await Anuncio.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('userId', 'nome email');

    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado' });

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

// === 8. REMOVER QUALQUER (ADMIN) ===
const removerQualquerAdmin = async (req, res) => {
  try {
    const anuncio = await Anuncio.findByIdAndDelete(req.params.id);
    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado' });
    res.json({ sucesso: true, mensagem: 'Removido com sucesso' });
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

// === 9. REGISTRAR VISUALIZAÇÃO (VIEW) ===
const registrarView = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
  }

  try {
    const anuncio = await Anuncio.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).select('views status');

    if (!anuncio || anuncio.status !== 'active') {
      return res.status(404).json({ sucesso: false });
    }

    req.io?.emit('anuncio:view', { anuncioId: id, views: anuncio.views });

    res.json({ sucesso: true, views: anuncio.views });
  } catch (error) {
    console.error('Erro view:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno' });
  }
};

// === 10. REGISTRAR CLIQUE - VERSÃO CORRIGIDA E CONFIÁVEL ===
const registrarClique = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  try {
    // 1. Incrementa o contador total
    const anuncio = await Anuncio.findOneAndUpdate(
      { _id: id, status: 'active' },
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!anuncio) {
      return res.status(404).json({ sucesso: false });
    }

    // 2. Atualiza ou cria entrada do dia no histórico
    const updated = await Anuncio.findOneAndUpdate(
      { _id: id, "clickHistory.date": hoje },
      { $inc: { "clickHistory.$.clicks": 1 } },
      { new: true }
    );

    if (!updated) {
      // Não existia entrada para hoje → cria
      await Anuncio.findByIdAndUpdate(id, {
        $push: {
          clickHistory: {
            $each: [{ date: hoje, clicks: 1 }],
            $slice: -30  // mantém apenas os últimos 30 dias
          }
        }
      });
    }

    // Busca o valor final para emitir no socket
    const finalAnuncio = await Anuncio.findById(id).select('clicks clickHistory');

    const hojeCliques = finalAnuncio.clickHistory
      .find(h => h.date.toISOString().split('T')[0] === hoje.toISOString().split('T')[0])
      ?.clicks || 1;

    // Emite atualização em tempo real
    req.io?.emit('anuncio:click', {
      anuncioId: id,
      clicks: finalAnuncio.clicks,
      todayClicks: hojeCliques
    });

    res.json({ sucesso: true, clicks: finalAnuncio.clicks });
  } catch (error) {
    console.error('Erro ao registrar clique:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno' });
  }
};

// === 11. ESTATÍSTICAS DETALHADAS (ADMIN) ===
const estatisticasAdmin = async (req, res) => {
  try {
    const anuncio = await Anuncio.findById(req.params.id)
      .populate('userId', 'nome email');

    if (!anuncio) return res.status(404).json({ sucesso: false, mensagem: 'Não encontrado' });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const seteDiasAtras = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);

    const historyMap = new Map(
      (anuncio.clickHistory || []).map(h => [
        h.date.toISOString().split('T')[0],
        h.clicks
      ])
    );

    const completo = [];
    for (let d = new Date(seteDiasAtras); d <= hoje; d.setDate(d.getDate() + 1)) {
      const dataStr = d.toISOString().split('T')[0];
      completo.push({
        date: new Date(dataStr),
        clicks: historyMap.get(dataStr) || 0
      });
    }

    res.json({
      views: anuncio.views || 0,
      clicks: anuncio.clicks || 0,
      impressions: (anuncio.views || 0) + (anuncio.clicks || 0),
      duration: anuncio.weeks * 7,
      statsHistory: completo
    });
  } catch (error) {
    console.error('Erro stats:', error);
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};


// === 12. ESTATÍSTICAS PARA O DONO DO ANÚNCIO ===
const estatisticasDoDono = async (req, res) => {
  try {
    const anuncio = await Anuncio.findOne({
      _id: req.params.id,
      userId: req.usuario.id  // ← garante que só a pessoa é dona
    });

    if (!anuncio) {
      return res.status(404).json({ 
        sucesso: false, 
        mensagem: 'Anúncio não encontrado ou você não tem permissão' 
      });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const seteDiasAtras = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Preenche os últimos 7 dias (mesmo que tenha buracos)
    const historyMap = new Map(
      (anuncio.clickHistory || []).map(h => [
        h.date.toISOString().split('T')[0],
        h.clicks
      ])
    );

    const ultimoSeteDias = [];
    for (let d = new Date(seteDiasAtras); d <= hoje; d.setDate(d.getDate() + 1)) {
      const dataStr = d.toISOString().split('T')[0];
      ultimoSeteDias.push({
        date: dataStr,
        clicks: historyMap.get(dataStr) || 0
      });
    }

    res.json({
      sucesso: true,
      stats: {
        views: anuncio.views || 0,
        clicks: anuncio.clicks || 0,
        ctr: anuncio.views > 0 ? ((anuncio.clicks / anuncio.views) * 100).toFixed(2) + '%' : '0%',
        hoje: ultimoSeteDias[ultimoSeteDias.length - 1]?.clicks || 0,
        ultimoSeteDias
      }
    });

  } catch (error) {
    console.error('Erro ao carregar stats do dono:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno' });
  }
};




// === EXPORTAR ===
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
  registrarView,
  registrarClique,
  estatisticasAdmin,
  estatisticasDoDono
};