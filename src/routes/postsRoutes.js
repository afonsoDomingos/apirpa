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
// SUBSTITUI TODA A FUNÇÃO ativarRpaBot POR ESTA (mais inteligente)
async function ativarRpaBot(post, req) {
  if (post.autor && post.autor._id === RPA_BOT_ID) return;

  const delay = 4000 + Math.random() * 4000;
  setTimeout(async () => {
    try {
      // CLASSIFICAÇÃO MAIS INTELIGENTE E PERMISSIVA
      const classificacaoPrompt = `
Analisa o post abaixo da comunidade RecuperaAqui (Perdidos e Achados de documentos).

Responde APENAS com:
PERGUNTA_VALIDA → se for qualquer dúvida, pedido de ajuda ou informação sobre documentos perdidos, achados, emissão, recuperação, guarda ou uso da plataforma
FORA_DO_TEMA → apenas se for saudação, piada, propaganda, política, ofensa ou conversa totalmente aleatória

Exemplos de PERGUNTA_VALIDA:
- "Perdi meu BI"
- "O que faço se encontrei um documento?"
- "Como tiro 2ª via?"
- "Alguém achou meu cartão?"

Post: "${post.conteudo}"

Resposta (só uma das duas palavras):
      `.trim();

      const classificacaoRes = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-oss-20b',
          temperature: 0,
          max_tokens: 15,
          messages: [{ role: 'user', content: classificacaoPrompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_BASE_URL || 'https://recuperaaqui.vercel.app',
            'X-Title': 'RpaAdmin',
          },
        }
      );

      const decisao = classificacaoRes.data.choices[0].message.content.trim();

      if (!decisao.includes('PERGUNTA_VALIDA')) {
        console.log(`RpaAdmin ignorou: "${post.conteudo}" → ${decisao}`);
        return;
      }

      console.log(`RpaAdmin vai responder: "${post.conteudo}"`);

      // RESPOSTA AMIGÁVEL E ÚTIL
      const respostaPrompt = `
Você é o RpaAdmin, assistente da comunidade RecuperaAqui.

Responda em português de Moçambique, de forma curta, educada e útil.
Se for sobre documento perdido: orienta a reportar na plataforma + onde tirar 2ª via.
Se for sobre documento encontrado: explica como reportar e ganhar comissão.

Pergunta: "${post.conteudo}"

Resposta (máximo 2 parágrafos):
      `.trim();

      const respostaRes = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'openai/gpt-oss-20b',
          temperature: 0.8,
          max_tokens: 200,
          messages: [{ role: 'user', content: respostaPrompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_BASE_URL || 'https://recuperaaqui.vercel.app',
            'X-Title': 'RpaAdmin Bot',
          },
        }
      );

      let respostaBot = respostaRes.data.choices[0].message.content.trim();
      if (!respostaBot) return;

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

      console.log(`RpaAdmin respondeu com sucesso!`);

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