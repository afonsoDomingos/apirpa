const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const noticiasModel = require('../models/noticiasModel');

// Upload de imagens
const UPLOAD_DIR = './uploads';
fs.ensureDirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

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

    const novaNoticia = new noticiasModel({
      titulo,
      resumo,
      conteudo,
      data: data || new Date(),
      imagem: req.file ? `/uploads/${req.file.filename}` : null
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
    const atualizacao = { ...req.body };
    if (req.file) atualizacao.imagem = `/uploads/${req.file.filename}`;

    const noticia = await noticiasModel.findByIdAndUpdate(req.params.id, atualizacao, { new: true });
    if (!noticia) return res.status(404).json({ error: 'Notícia não encontrada' });

    res.json(noticia);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remover notícia
router.delete('/:id', async (req, res) => {
  try {
    const noticia = await noticiasModel.findByIdAndDelete(req.params.id);
    if (!noticia) return res.status(404).json({ error: 'Notícia não encontrada' });

    if (noticia.imagem) {
      const filePath = path.join(__dirname, '..', noticia.imagem);
      fs.remove(filePath).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Incrementar visualizações
router.patch('/:id', async (req, res) => {
  try {
    const noticia = await noticiasModel.findById(req.params.id);
    if (!noticia) return res.status(404).json({ error: 'Notícia não encontrada' });

    noticia.visualizacoes = (noticia.visualizacoes || 0) + 1;
    await noticia.save();

    res.json({ success: true, visualizacoes: noticia.visualizacoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
