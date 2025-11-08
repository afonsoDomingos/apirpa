const Anuncio = require('../models/Anuncio');
const multer = require('multer');
const { storageAnuncios } = require('../config/cloudinary');

const upload = multer({
  storage: storageAnuncios,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo inválido. Use JPEG ou PNG.'));
    }
    cb(null, true);
  }
}).single('image');

const criarAnuncio = (req, res) => {
  console.log('POST /api/anuncios - Criando anúncio');
  console.log('Usuário:', req.usuario?.id);

  // Validar req.usuario
  if (!req.usuario?.id) {
    console.log('Erro: Usuário não autenticado');
    return res.status(401).json({ sucesso: false, mensagem: 'Usuário não autenticado' });
  }

  upload(req, res, async (err) => {
    if (err) {
      console.log('Erro no upload:', err.message);
      return res.status(400).json({ sucesso: false, mensagem: err.message });
    }

    try {
      const { name, description, price, ctaLink, weeks = 1, imageUrl } = req.body;
      console.log('Payload recebido:', { name, description, price, ctaLink, weeks, imageUrl, file: req.file });

      // Validação dos campos
      if (!name || name.trim().length < 3) {
        return res.status(400).json({ sucesso: false, mensagem: 'Nome do anúncio é obrigatório e deve ter pelo menos 3 caracteres' });
      }
      if (!price || isNaN(price) || Number(price) <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Preço é obrigatório e deve ser um número positivo' });
      }
      if (!ctaLink || !/^https?:\/\//.test(ctaLink)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Link de contato inválido' });
      }
      if (!weeks || isNaN(weeks) || Number(weeks) < 1) {
        return res.status(400).json({ sucesso: false, mensagem: 'Semanas devem ser um número positivo' });
      }
      if (!req.file && !imageUrl) {
        return res.status(400).json({ sucesso: false, mensagem: 'Imagem ou URL da imagem é obrigatória' });
      }

      const image = req.file ? req.file.path : imageUrl;
      const amount = Number(weeks) * 500;

      const anuncio = new Anuncio({
        name: name.trim(),
        description: description || '',
        price: Number(price),
        ctaLink: ctaLink.trim(),
        image,
        weeks: Number(weeks),
        amount,
        userId: req.usuario.id,
        status: 'pending'
      });

      console.log('Anúncio a ser salvo:', anuncio);

      await anuncio.save();
      console.log('Anúncio criado:', anuncio._id);
      res.status(201).json({ sucesso: true, anuncioId: anuncio._id, anuncio });
    } catch (error) {
      console.error('Erro ao salvar anúncio:', error);
      res.status(500).json({ sucesso: false, mensagem: `Erro ao criar anúncio: ${error.message}` });
    }
  });
};

// Demais funções (meusAnuncios, anunciosAtivos, atualizarAnuncio, removerAnuncio) mantidas
const meusAnuncios = async (req, res) => {
  console.log(`GET /api/anuncios/meus - Usuário: ${req.usuario.id}`);
  try {
    const anuncios = await Anuncio.find({ userId: req.usuario.id }).sort({ createdAt: -1 });
    console.log(`Encontrados ${anuncios.length} anúncios`);
    res.json(anuncios);
  } catch (error) {
    console.error('Erro ao buscar:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar' });
  }
};

const anunciosAtivos = async (req, res) => {
  console.log('GET /api/anuncios/ativos - Buscando ativos');
  try {
    const anuncios = await Anuncio.find({ status: 'active' }).select('-userId');
    console.log(`Encontrados ${anuncios.length} anúncios ativos`);
    res.json(anuncios);
  } catch (error) {
    console.error('Erro ao carregar ativos:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar' });
  }
};

const atualizarAnuncio = (req, res) => {
  console.log(`PUT /api/anuncios/${req.params.id} - Usuário: ${req.usuario.id}`);
  upload(req, res, async (err) => {
    if (err) {
      console.log('Erro no upload:', err.message);
      return res.status(400).json({ sucesso: false, mensagem: err.message });
    }
    try {
      const { name, description, price, ctaLink, weeks, imageUrl } = req.body;
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (description) updateData.description = description;
      if (price) updateData.price = Number(price);
      if (ctaLink) updateData.ctaLink = ctaLink.trim();
      if (weeks) {
        updateData.weeks = Number(weeks);
        updateData.amount = Number(weeks) * 500;
      }
      if (req.file) {
        updateData.image = req.file.path;
      } else if (imageUrl) {
        updateData.image = imageUrl;
      }
      const anuncio = await Anuncio.findOneAndUpdate(
        { _id: req.params.id, userId: req.usuario.id },
        updateData,
        { new: true, runValidators: true }
      );
      if (!anuncio) {
        console.log('Anúncio não encontrado ou sem permissão');
        return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });
      }
      console.log('Anúncio atualizado:', anuncio._id);
      res.json({ sucesso: true, anuncio });
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      res.status(500).json({ sucesso: false, mensagem: `Erro ao atualizar anúncio: ${error.message}` });
    }
  });
};

const removerAnuncio = async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/anuncios/${id} - Usuário: ${req.usuario.id}`);
  try {
    const anuncio = await Anuncio.findOneAndDelete({
      _id: id,
      userId: req.usuario.id,
    });
    if (!anuncio) {
      console.log('Anúncio não encontrado');
      return res.status(404).json({ sucesso: false, mensagem: 'Anúncio não encontrado' });
    }
    console.log('Anúncio removido:', id);
    res.json({ sucesso: true, mensagem: 'Removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover' });
  }
};

module.exports = {
  criarAnuncio,
  meusAnuncios,
  anunciosAtivos,
  atualizarAnuncio,
  removerAnuncio,
};