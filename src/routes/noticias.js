const express = require('express');
const router = express.Router();
const multer = require('multer');
const noticiasModel = require('../models/noticiasModel');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuração do multer (sem salvar no disco)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const ext = allowedTypes.test(file.mimetype);
    if (ext) return cb(null, true);
    cb(new Error('Apenas imagens são permitidas'));
  },
});

// Função para upload no Cloudinary
const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'noticias' },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// Listar notícias
router.get('/', async (req, res) => {
  try {
    const noticias = await noticiasModel.find().sort({ data: -1 });
    res.json(noticias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar notícia
router.post('/', upload.single('imagem'), async (req, res) => {
  try {
    const { titulo, resumo, conteudo, data } = req.body;
    if (!titulo || !resumo || !conteudo)
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });

    let imagemUrl = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imagemUrl = result.secure_url;
    }

    const novaNoticia = new noticiasModel({
      titulo,
      resumo,
      conteudo,
      data: data ? new Date(data) : new Date(),
      imagem: imagemUrl,
    });

    await novaNoticia.save();
    res.status(201).json(novaNoticia);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar notícia
router.put('/:id', upload.single('imagem'), async (req, res) => {
  try {
    const noticia = await noticiasModel.findById(req.params.id);
    if (!noticia)
      return res.status(404).json({ error: 'Notícia não encontrada' });

    let imagemUrl = noticia.imagem;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imagemUrl = result.secure_url;
    }

    const noticiaAtualizada = await noticiasModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, imagem: imagemUrl },
      { new: true }
    );

    res.json(noticiaAtualizada);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remover notícia
router.delete('/:id', async (req, res) => {
  try {
    const noticia = await noticiasModel.findByIdAndDelete(req.params.id);
    if (!noticia)
      return res.status(404).json({ error: 'Notícia não encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Incrementar visualizações
router.patch('/:id', async (req, res) => {
  try {
    const noticia = await noticiasModel.findByIdAndUpdate(
      req.params.id,
      { $inc: { visualizacoes: 1 } },
      { new: true }
    );
    if (!noticia)
      return res.status(404).json({ error: 'Notícia não encontrada' });
    res.json({ success: true, visualizacoes: noticia.visualizacoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
