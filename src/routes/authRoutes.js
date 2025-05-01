const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/authModel');
const verificarToken = require('../middleware/authMiddleware'); // middleware separado

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

    const novoUsuario = new Usuario({ nome, email, senha, role: role || 'cliente' });
    await novoUsuario.save();

    res.status(201).json({ msg: 'Usuário registrado com sucesso', usuario: { nome, email, role: novoUsuario.role } });
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
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

// Rota de teste protegida
router.get('/protegida', verificarToken, (req, res) => {
  res.json({ msg: 'Acesso autorizado', usuario: req.usuario });
});

module.exports = router;
