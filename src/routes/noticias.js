const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');

const DATA_FILE = './noticias.json';
const UPLOAD_DIR = './uploads';

// Cria a pasta de uploads se não existir
fs.ensureDirSync(UPLOAD_DIR);

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Função para ler notícias
const lerNoticias = async () => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// Função para salvar notícias
const salvarNoticias = async (noticias) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(noticias, null, 2));
};

// Listar todas as notícias
router.get('/', async (req, res) => {
  const noticias = await lerNoticias();
  res.json(noticias);
});

// Criar nova notícia com upload de imagem
router.post('/', upload.single('imagem'), async (req, res) => {
  const { titulo, resumo, conteudo, data } = req.body;

  if (!titulo || !resumo || !conteudo) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  const noticias = await lerNoticias();

  const novaNoticia = {
    id: Date.now(),
    titulo,
    resumo,
    conteudo,
    data: data || new Date().toLocaleDateString(),
    imagem: req.file ? `/uploads/${req.file.filename}` : null
  };

  noticias.push(novaNoticia);
  await salvarNoticias(noticias);
  res.status(201).json(novaNoticia);
});

// Editar notícia (também permite atualizar imagem)
router.put('/:id', upload.single('imagem'), async (req, res) => {
  const id = parseInt(req.params.id);
  const noticias = await lerNoticias();
  const index = noticias.findIndex(n => n.id === id);
  if (index === -1) return res.status(404).json({ error: 'Notícia não encontrada' });

  const atualizacao = { ...req.body };
  if (req.file) {
    atualizacao.imagem = `/uploads/${req.file.filename}`;
  }

  noticias[index] = { ...noticias[index], ...atualizacao };
  await salvarNoticias(noticias);
  res.json(noticias[index]);
});

// Remover notícia
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  let noticias = await lerNoticias();

  const noticia = noticias.find(n => n.id === id);
  if (noticia?.imagem) {
    // remove a imagem do servidor
    const filePath = path.join(__dirname, '..', noticia.imagem);
    fs.remove(filePath).catch(() => {});
  }

  noticias = noticias.filter(n => n.id !== id);
  await salvarNoticias(noticias);
  res.json({ success: true });
});

module.exports = router;
