const express = require('express');
const router = express.Router();
const Post = require('../models/postModel');
const Usuario = require('../models/usuarioModel');
const verificarToken = require('../middleware/authMiddleware'); // middleware JWT

// Listar todos os posts (mais recentes primeiro) com populate seguro
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });

    const populatedPosts = await Promise.all(
      posts.map(async post => {
        const autor = await Usuario.findById(post.autor).select('nome initials role').lean();
        const replies = await Promise.all(
          post.replies.map(async reply => {
            const replyAutor = await Usuario.findById(reply.autor).select('nome initials role').lean();
            return { ...reply.toObject(), autor: replyAutor || { nome: 'Desconhecido' } };
          })
        );
        return { ...post.toObject(), autor: autor || { nome: 'Desconhecido' }, replies };
      })
    );

    res.json(populatedPosts);
  } catch (error) {
    console.error('Erro ao listar posts:', error);
    res.status(500).json({ message: 'Erro ao listar posts', error });
  }
});

// Criar novo post
router.post('/', verificarToken, async (req, res) => {
  try {
    const { conteudo } = req.body;
    const post = new Post({ autor: req.usuario.id, conteudo });
    await post.save();

    const autor = await Usuario.findById(post.autor).select('nome initials role').lean();
    res.status(201).json({ ...post.toObject(), autor: autor || { nome: 'Desconhecido' } });
  } catch (error) {
    console.error('Erro ao criar post:', error);
    res.status(500).json({ message: 'Erro ao criar post', error });
  }
});

// Curtir/descurtir post
router.post('/:postId/like', verificarToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    const index = post.likes.indexOf(req.usuario.id);
    if (index === -1) post.likes.push(req.usuario.id);
    else post.likes.splice(index, 1);

    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao curtir post', error });
  }
});

// Adicionar resposta
router.post('/:postId/replies', verificarToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { conteudo } = req.body;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post não encontrado' });

    post.replies.push({ autor: req.usuario.id, conteudo });
    await post.save();

    const populatedReplies = await Promise.all(
      post.replies.map(async reply => {
        const replyAutor = await Usuario.findById(reply.autor).select('nome initials role').lean();
        return { ...reply.toObject(), autor: replyAutor || { nome: 'Desconhecido' } };
      })
    );

    res.status(201).json({ ...post.toObject(), replies: populatedReplies });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao adicionar resposta', error });
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
    res.json({ message: 'Post deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar post', error });
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
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar resposta', error });
  }
});

module.exports = router;
