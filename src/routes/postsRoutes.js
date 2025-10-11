// routes/postsRoutes.js
const express = require('express');
const router = express.Router();
const Post = require('../models/postModel');
const Usuario = require('../models/usuarioModel');

// Middleware simples de autenticação (substitua conforme seu auth real)
const authMiddleware = async (req, res, next) => {
  try {
    const userId = req.header('user-id'); // por enquanto passamos user-id no header
    if (!userId) return res.status(401).json({ message: 'Usuário não autenticado' });

    const user = await Usuario.findById(userId);
    if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Erro na autenticação', error });
  }
};

// Listar todos os posts (mais recentes primeiro)
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('autor', 'nome initials role')
      .populate('replies.autor', 'nome initials role')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar posts', error });
  }
});

// Criar novo post
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { conteudo } = req.body;
    const post = new Post({ autor: req.user._id, conteudo });
    await post.save();
    const populatedPost = await post.populate('autor', 'nome initials role');
    res.status(201).json(populatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar post', error });
  }
});

// Curtir/descurtir post
router.put('/:postId/like', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    const index = post.likes.indexOf(req.user._id);
    if (index === -1) post.likes.push(req.user._id);
    else post.likes.splice(index, 1);

    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao curtir post', error });
  }
});

// Adicionar resposta
router.post('/:postId/replies', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { conteudo } = req.body;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    post.replies.push({ autor: req.user._id, conteudo });
    await post.save();
    await post.populate('replies.autor', 'nome initials role');

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao adicionar resposta', error });
  }
});

// Deletar post
router.delete('/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    if (post.autor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Sem permissão para deletar este post' });
    }

    await post.remove();
    res.json({ message: 'Post deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar post', error });
  }
});

// Deletar reply
router.delete('/:postId/replies/:replyId', authMiddleware, async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    const reply = post.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

    if (reply.autor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Sem permissão para deletar esta resposta' });
    }

    reply.remove();
    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar resposta', error });
  }
});

module.exports = router;
