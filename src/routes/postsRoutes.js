// routes/postsRoutes.js
const express = require('express');
const router = express.Router();
const Post = require('../models/postModel');
const verificarToken = require('../middleware/authMiddleware');
const axios = require('axios');
const multer = require('multer');
const { storagePosts } = require('../config/cloudinary');

const upload = multer({
  storage: storagePosts,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo inválido. Apenas imagens são permitidas.'));
    }
  }
});

// ID do usuário RpaAdmin (já existente no seu MongoDB)
const RPA_BOT_ID = "685bff7d1b6abc16c490af52";

// ====================================================
// FUNÇÃO: RpaAdmin Bot (responde automaticamente)
// ====================================================
// SUBSTITUI TODA A FUNÇÃO ativarRpaBot POR ESTA (mais inteligente)
// ====================================================
// FUNÇÃO: RpaAdmin Bot (VERSÃO FINAL 100% FUNCIONAL)
// ====================================================
// ====================================================
// RPAADMIN BOT — VERSÃO FINAL PERFEITA (NUNCA MAIS IGNORA!)
// ====================================================
async function ativarRpaBot(post, req) {
  // Evita loop
  if (post.autor && post.autor._id === RPA_BOT_ID) return;

  const delay = 4000 + Math.random() * 4000;
  setTimeout(async () => {
    try {
      const texto = post.conteudo.toLowerCase();

      // PALAVRAS-CHAVE QUE SEMPRE DISPARAM RESPOSTA (100% garantido)
      const palavrasChave = [
        'perdi', 'perdeu', 'perda', 'roubaram', 'roubado',
        'encontrei', 'achei', 'achado', 'encontrado',
        'bi', 'bilhete', 'identidade', 'passaporte',
        'carta', 'condução', 'certificado', 'habilitações',
        'documento', 'documentos', 'segunda via', '2ª via', 'duplicado',
        'recupera', 'recuperar', 'plataforma', 'rpa', 'ajuda'
      ];

      const temPalavraChave = palavrasChave.some(palavra => texto.includes(palavra));

      // Se tiver qualquer uma dessas palavras → responde SEMPRE
      if (!temPalavraChave) {
        console.log(`RpaAdmin ignorou (fora do tema): "${post.conteudo}"`);
        return;
      }

      console.log(`RpaAdmin DETECTOU documento → vai responder: "${post.conteudo}"`);

      // Prompt perfeito para Moçambique + curto + útil
      const respostaPrompt = `
Você é o RpaAdmin, assistente oficial da RecuperaAqui em Moçambique.

Responda em português de Moçambique, com no máximo 2 parágrafos, educado e direto ao ponto.

Regras:
- Se for documento PERDIDO → diz para reportar na plataforma + onde tirar 2ª via
- Se for documento ENCONTRADO → explica como entregar e ganhar comissão
- Sempre incentiva usar a plataforma RecuperaAqui

Mensagem do usuário: "${post.conteudo}"

Resposta:`;

      const respostaRes = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-oss-20b',
          temperature: 0.8,
          max_tokens: 220,
          messages: [{ role: 'user', content: respostaPrompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_BASE_URL || 'https://recuperaaqui.vercel.app',
            'X-Title': 'RpaAdmin Bot',
          },
          timeout: 15000,
        }
      );

      let respostaBot = respostaRes.data.choices[0].message.content.trim();

      // Fallback caso venha vazio (nunca mais acontece)
      if (!respostaBot || respostaBot.length < 10) {
        respostaBot = "Olá! Parece que estás com um problema com documentos. Reporta aqui na plataforma RecuperaAqui para aumentar as chances de recuperar ou entregar com comissão. Se precisares de ajuda com segunda via, posso te orientar!";
      }

      // Salva e emite
      const postAtualizado = await Post.findById(post._id);
      if (!postAtualizado) return;

      postAtualizado.replies.push({
        autor: RPA_BOT_ID,
        conteudo: respostaBot,
      });

      await postAtualizado.save();
      await postAtualizado.populate('replies.autor', 'nome initials role');

      const io = req.app.get('io');
      if (io) {
        io.emit('novaResposta', {
          postId: postAtualizado._id,
          replies: postAtualizado.replies,
        });
      }

      console.log('RpaAdmin respondeu com sucesso!');

    } catch (err) {
      console.error('Erro crítico no RpaAdmin:', err.message);
    }
  }, delay);
}

// ====================================================
// ROTAS ORIGINAIS (com bot integrado)
// ====================================================

// Listar posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('autor', 'nome initials role')
      .populate('replies.autor', 'nome initials role')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error('Erro ao listar posts:', error);
    res.status(500).json({ message: 'Erro ao listar posts', error: error.message });
  }
});

// Criar post + ATIVA RPA BOT
// Criar post + ATIVA RPA BOT
router.post('/', verificarToken, upload.single('imagem'), async (req, res) => {
  try {
    const { conteudo } = req.body;

    // Validar se tem conteúdo (obrigatório pelo Model)
    // Se quiser permitir post só com imagem, teria que mudar o Model para conteudo: { required: false }
    if (!conteudo || !conteudo.trim()) {
      return res.status(400).json({ message: 'Conteúdo do post é obrigatório' });
    }

    const novoPostData = {
      autor: req.usuario.id,
      conteudo
    };

    if (req.file && req.file.path) {
      novoPostData.imagem = req.file.path;
    }

    const post = new Post(novoPostData);
    await post.save();
    const populatedPost = await post.populate('autor', 'nome initials role');

    // Emite o novo post em tempo real
    const io = req.app.get('io');
    if (io) io.emit('novoPost', populatedPost);

    res.status(201).json(populatedPost);

    // ATIVA O BOT AUTOMATICAMENTE
    ativarRpaBot(populatedPost, req);

  } catch (error) {
    console.error('Erro ao criar post:', error);
    res.status(500).json({ message: 'Erro ao criar post', error: error.message });
  }
});

// Curtir/descurtir post
router.put('/:postId/like', verificarToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    const index = post.likes.indexOf(req.usuario.id);
    if (index === -1) post.likes.push(req.usuario.id);
    else post.likes.splice(index, 1);

    await post.save();

    const io = req.app.get('io');
    if (io) io.emit('postLiked', { postId: post._id, likes: post.likes });

    res.json(post);
  } catch (error) {
    console.error('Erro ao curtir post:', error);
    res.status(500).json({ message: 'Erro ao curtir post', error: error.message });
  }
});

// Adicionar resposta (manual)
router.post('/:postId/replies', verificarToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { conteudo } = req.body;

    if (!conteudo || !conteudo.trim()) {
      return res.status(400).json({ message: 'Conteúdo da resposta é obrigatório' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    post.replies.push({ autor: req.usuario.id, conteudo });
    await post.save();
    await post.populate('replies.autor', 'nome initials role');

    const io = req.app.get('io');
    if (io) io.emit('novaResposta', { postId: post._id, replies: post.replies });

    res.status(201).json(post);
  } catch (error) {
    console.error('Erro ao adicionar resposta:', error);
    res.status(500).json({ message: 'Erro ao adicionar resposta', error: error.message });
  }
});

// Deletar post
router.delete('/:postId', verificarToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    if (post.autor.toString() !== req.usuario.id.toString()) {
      return res.status(403).json({ message: 'Sem permissão para deletar este post' });
    }

    await post.remove();

    const io = req.app.get('io');
    if (io) io.emit('postDeletado', { postId });

    res.json({ message: 'Post deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar post:', error);
    res.status(500).json({ message: 'Erro ao deletar post', error: error.message });
  }
});

// Deletar reply
router.delete('/:postId/replies/:replyId', verificarToken, async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    const reply = post.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

    if (reply.autor.toString() !== req.usuario.id.toString()) {
      return res.status(403).json({ message: 'Sem permissão para deletar esta resposta' });
    }

    reply.remove();
    await post.save();

    const io = req.app.get('io');
    if (io) io.emit('respostaDeletada', { postId, replyId });

    res.json(post);
  } catch (error) {
    console.error('Erro ao deletar resposta:', error);
    res.status(500).json({ message: 'Erro ao deletar resposta', error: error.message });
  }
});

module.exports = router;