const express = require('express');
const router = express.Router();
const Post = require('../models/postModel');
const verificarToken = require('../middleware/authMiddleware');

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

// Criar post
router.post('/', verificarToken, async (req, res) => {
  try {
    const { conteudo } = req.body;
    if (!conteudo || !conteudo.trim()) {
      return res.status(400).json({ message: 'Conteúdo do post é obrigatório' });
    }

    const post = new Post({ autor: req.usuario.id, conteudo });
    await post.save();
    const populatedPost = await post.populate('autor', 'nome initials role');

    // 🔴 Emite evento em tempo real
    const io = req.app.get('io');
    if (io) io.emit('novoPost', populatedPost);

    res.status(201).json(populatedPost);
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
    if (io) io.emit('postLiked', { postId: post._id, likes: post.likes }); // 🔴 emite atualização

    res.json(post);
  } catch (error) {
    console.error('Erro ao curtir post:', error);
    res.status(500).json({ message: 'Erro ao curtir post', error: error.message });
  }
});

// Adicionar resposta
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
    if (io) io.emit('novaResposta', { postId: post._id, replies: post.replies }); // 🔴 evento em tempo real

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
    if (io) io.emit('postDeletado', { postId }); // 🔴 broadcast para remover no front

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
    if (io) io.emit('respostaDeletada', { postId, replyId }); // 🔴 evento ao apagar reply

    res.json(post);
  } catch (error) {
    console.error('Erro ao deletar resposta:', error);
    res.status(500).json({ message: 'Erro ao deletar resposta', error: error.message });
  }
});

module.exports = router;
