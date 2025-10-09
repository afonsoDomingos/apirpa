const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const noticiasModel = require('../models/noticiasModel');

const UPLOAD_DIR = './uploads';
fs.ensureDirSync(UPLOAD_DIR);

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // máximo 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Apenas imagens são permitidas'));
  }
});

// Listar notícias
router.get('/', async (req, res) => {
  console.log('GET / - Listando notícias');
  try {
    const noticias = await noticiasModel.find().sort({ data: -1 });
    console.log(`Encontradas ${noticias.length} notícias`);
    res.json(noticias);
  } catch (err) {
    console.error('Erro ao listar notícias:', err);
    res.status(500).json({ error: err.message });
  }
});

// Criar notícia
router.post('/', (req, res) => {
  console.log('POST / - Criando notícia');
  upload.single('imagem')(req, res, async (err) => {
    if (err) {
      console.error('Erro no upload:', err.message);
      return res.status(400).json({ error: err.message });
    }

    try {
      const { titulo, resumo, conteudo, data } = req.body;
      if (!titulo || !resumo || !conteudo) {
        console.warn('Campos obrigatórios faltando');
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
      }

      let noticiaData = data ? new Date(data) : new Date();
      if (isNaN(noticiaData.getTime())) noticiaData = new Date();

      const novaNoticia = new noticiasModel({
        titulo,
        resumo,
        conteudo,
        data: noticiaData,
        imagem: req.file ? `/uploads/${req.file.filename}` : null
      });

      await novaNoticia.save();
      console.log('Notícia criada com sucesso:', novaNoticia._id);
      res.status(201).json(novaNoticia);
    } catch (err) {
      console.error('Erro ao criar notícia:', err);
      res.status(500).json({ error: err.message });
    }
  });
});

// Editar notícia
router.put('/:id', (req, res) => {
  console.log(`PUT /${req.params.id} - Editando notícia`);
  upload.single('imagem')(req, res, async (err) => {
    if (err) {
      console.error('Erro no upload:', err.message);
      return res.status(400).json({ error: err.message });
    }

    try {
      const noticia = await noticiasModel.findById(req.params.id);
      if (!noticia) {
        console.warn('Notícia não encontrada');
        return res.status(404).json({ error: 'Notícia não encontrada' });
      }

      const atualizacao = { ...req.body };
      if (req.file) {
        if (noticia.imagem) {
          const oldPath = path.join(__dirname, '..', noticia.imagem);
          await fs.remove(oldPath);
          console.log('Imagem antiga removida:', oldPath);
        }
        atualizacao.imagem = `/uploads/${req.file.filename}`;
      }

      const noticiaAtualizada = await noticiasModel.findByIdAndUpdate(
        req.params.id,
        atualizacao,
        { new: true }
      );

      console.log('Notícia atualizada com sucesso:', noticiaAtualizada._id);
      res.json(noticiaAtualizada);
    } catch (err) {
      console.error('Erro ao atualizar notícia:', err);
      res.status(500).json({ error: err.message });
    }
  });
});

// Remover notícia
router.delete('/:id', async (req, res) => {
  console.log(`DELETE /${req.params.id} - Removendo notícia`);
  try {
    const noticia = await noticiasModel.findByIdAndDelete(req.params.id);
    if (!noticia) {
      console.warn('Notícia não encontrada');
      return res.status(404).json({ error: 'Notícia não encontrada' });
    }

    if (noticia.imagem) {
      const filePath = path.join(__dirname, '..', noticia.imagem);
      await fs.remove(filePath);
      console.log('Imagem removida:', filePath);
    }

    console.log('Notícia removida com sucesso:', noticia._id);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao remover notícia:', err);
    res.status(500).json({ error: err.message });
  }
});

// Incrementar visualizações
router.patch('/:id', async (req, res) => {
  console.log(`PATCH /${req.params.id} - Incrementando visualizações`);
  try {
    const noticia = await noticiasModel.findByIdAndUpdate(
      req.params.id,
      { $inc: { visualizacoes: 1 } },
      { new: true }
    );
    if (!noticia) {
      console.warn('Notícia não encontrada');
      return res.status(404).json({ error: 'Notícia não encontrada' });
    }

    console.log('Visualizações atualizadas:', noticia.visualizacoes);
    res.json({ success: true, visualizacoes: noticia.visualizacoes });
  } catch (err) {
    console.error('Erro ao incrementar visualizações:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
