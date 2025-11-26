// routes/postsRoutes.js
const express = require('express');
const router = express.Router();
const Post = require('../models/postModel');
const verificarToken = require('../middleware/authMiddleware');
const axios = require('axios');

// ID do usuário RpaAdmin (já existente no seu MongoDB)
const RPA_BOT_ID = "685bff7d1b6abc16c490af52";

// ====================================================
// FUNÇÃO: RpaAdmin Bot (responde automaticamente)
// ====================================================
async function ativarRpaBot(post, req) {
  // Ignora posts do próprio bot
  if (post.autor && post.autor._id === RPA_BOT_ID) return;

  // Delay natural (4 a 8 segundos)
  const delay = 4000 + Math.random() * 4000;
  setTimeout(async () => {
    try {
      // 1. CLASSIFICAÇÃO: É uma pergunta válida?
      const classificacaoPrompt = `
Você é moderador da comunidade RecuperaAqui (Perdidos e Achados de documentos).

Responda APENAS com uma das palavras abaixo:

PERGUNTA_VALIDA → se for dúvida real sobre documentos perdidos, achados, emissão, recuperação ou uso da plataforma.
FORA_DO_TEMA → qualquer outro tipo de post (saudação, piada, propaganda, conversa aleatória, etc).

Post: "${post.conteudo}"

Resposta (apenas a palavra):
      `.trim();

      const classificacaoRes = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-oss-20b',
          temperature: 0,
          max_tokens: 10,
          messages: [{ role: 'user', content: classificacaoPrompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_BASE_URL || 'https://recuperaaqui.vercel.app',
            'X-Title': 'RpaAdmin Moderador',
          },
          timeout: 12000,
        }
      );

      const decisao = classificacaoRes.data.choices[0].message.content.trim().toUpperCase();

      if (!decisao.includes('PERGUNTA_VALIDA')) {
        console.log(`RpaAdmin ignorou (fora do tema): "${post.conteudo}"`);
        return;
      }

      // 2. GERA RESPOSTA ÚTIL
      const respostaPrompt = `
Você é o RpaAdmin, assistente oficial da comunidade RecuperaAqui.

Responda em português de Moçambique, de forma educada, curta e útil (máximo 2 parágrafos).
Foco: documentos perdidos, achados, emissão, recuperação e uso da plataforma.

Pergunta do usuário: "${post.conteudo}"

Resposta direta e objetiva:
      `.trim();

      const respostaRes = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-oss-20b',
          temperature: 0.7,
          max_tokens: 180,
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
      if (!respostaBot || respostaBot.length < 5) return;

      // 3. SALVA A RESPOSTA NO BANCO
      const postAtualizado = await Post.findById(post._id);
      if (!postAtualizado) return;

      postAtualizado.replies.push({
        autor: RPA_BOT_ID,
        conteudo: respostaBot,
      });

      await postAtualizado.save();
      await postAtualizado.populate('replies.autor', 'nome initials role');

      // 4. EMITE VIA SOCKET.IO
      const io = req.app.get('io');
      if (io) {
        io.emit('novaResposta', {
          postId: postAtualizado._id,
          replies: postAtualizado.replies,
        });
      }

      console.log(`RpaAdmin respondeu: "${respostaBot}"`);

    } catch (err) {
      console.error('Erro no RpaAdmin Bot:', err.message);
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
router.post('/', verificarToken, async (req, res) => {
  try {
    const { conteudo } = req.body;
    if (!conteudo || !conteudo.trim()) {
      return res.status(400).json({ message: 'Conteúdo do post é obrigatório' });
    }

    const post = new Post({ autor: req.usuario.id, conteudo });
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