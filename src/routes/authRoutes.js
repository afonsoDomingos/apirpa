const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/authModel');
const verificarToken = require('../middleware/authMiddleware');
console.log('Middleware:', verificarToken); // Deve mostrar a função



const router = express.Router();

router.get('/', (req, res) => {
  res.send('Rota de autenticação funcionando!');
});

router.post('/register', async (req, res) => {
  const { nome, email, senha, role } = req.body;

  try {
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ msg: 'Usuário já existe' });
    }

    // Criptografa a senha antes de salvar
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novoUsuario = new Usuario({ nome, email, senha: senhaHash, role: role || 'cliente' });
    await novoUsuario.save();

    res.status(201).json({ msg: 'Usuário registrado com sucesso', usuario: { nome, email, role: novoUsuario.role } });
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});



router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    // Permitir login com email ou nome
    const usuario = await Usuario.findOne({
      $or: [{ email }, { nome: email }]
    });

    if (!usuario) return res.status(400).json({ msg: 'Usuário não encontrado' });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(400).json({ msg: 'Senha incorreta' });

    const token = jwt.sign(
      { id: usuario._id, role: usuario.role },
      process.env.JWT_SECRET || 'seu_jwt_secret',
      { expiresIn: '1h' }
    );

    const redirectUrl = usuario.role === 'admin' ? '/dashboard/admin' : '/home';

    res.json({
      msg: 'Login bem-sucedido',
      token,
      usuario: { id: usuario._id, nome: usuario.nome, role: usuario.role },
      redirectUrl,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});


router.get('/usuarios', async (req, res) => {
  try {
    const { role } = req.query;
    const usuarios = await Usuario.find(role ? { role } : {});
    const usuariosFiltrados = usuarios.map(({ _id, nome, email, role }) => ({ id: _id, nome, email, role }));
    res.json(usuariosFiltrados);
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao buscar usuários', erro: err.message });
  }
});

// Atualizar usuário (somente o próprio usuário ou admin)
router.patch('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nome, senha } = req.body;

  if (req.usuario.id !== id && req.usuario.role !== 'admin') {
    return res.status(403).json({ msg: 'Acesso negado' });
  }

  try {
    const updateData = {};
    if (nome) updateData.nome = nome;
    if (senha) {
      const salt = await bcrypt.genSalt(10);
      updateData.senha = await bcrypt.hash(senha, salt);
    }

    const usuarioAtualizado = await Usuario.findByIdAndUpdate(id, updateData, { new: true });
    if (!usuarioAtualizado) return res.status(404).json({ msg: 'Usuário não encontrado' });

    res.json({
      msg: 'Usuário atualizado',
      usuario: {
        id: usuarioAtualizado._id,
        nome: usuarioAtualizado.nome,
        email: usuarioAtualizado.email,
        role: usuarioAtualizado.role,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao atualizar usuário', erro: err.message });
  }
});

// Deletar usuário (somente admin)
router.delete('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;

  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ msg: 'Acesso negado' });
  }

  try {
    const usuarioRemovido = await Usuario.findByIdAndDelete(id);
    if (!usuarioRemovido) return res.status(404).json({ msg: 'Usuário não encontrado' });

    res.json({ msg: 'Usuário removido com sucesso' });
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao remover usuário', erro: err.message });
  }
});

// Rota protegida (teste)
router.get('/protegida', verificarToken, (req, res) => {
  res.json({ msg: 'Acesso autorizado', usuario: req.usuario });
});

module.exports = router;
