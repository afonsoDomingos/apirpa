const express = require('express');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/authModel');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { nome, email, senha, role } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ msg: 'Nome, e-mail e senha são obrigatórios' });
  }

  try {
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ msg: 'Já existe um usuário com este e-mail' });
    }

    // Não precisa criptografar aqui, o middleware do schema faz isso
    const novoUsuario = new Usuario({
      nome,
      email,
      senha,
      role: role || 'cliente',
    });

    await novoUsuario.save();

    res.status(201).json({
      msg: 'Usuário registrado com sucesso',
      usuario: {
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        role: novoUsuario.role
      }
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ msg: 'E-mail e senha são obrigatórios' });
  }

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ msg: 'Usuário não encontrado' });
    }

    const senhaValida = await usuario.matchSenha(senha.trim());
    if (!senhaValida) {
      return res.status(400).json({ msg: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: usuario._id, role: usuario.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      msg: 'Login bem-sucedido',
      token,
      usuario: { id: usuario._id, nome: usuario.nome, role: usuario.role },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

module.exports = router;
