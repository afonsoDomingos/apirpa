const express = require('express');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const Usuario = require('../models/authModel');
const verificarToken = require('../middleware/authMiddleware');
const { OAuth2Client } = require("google-auth-library");
const { enviarEmail } = require("../services/emailService"); // serviço de e-mail
require("dotenv").config();

// Log para depuração
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();

// Registrar novo usuário
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

    const salt = await bcryptjs.genSalt(10);
    const senhaHash = await bcryptjs.hash(senha, salt);

    const novoUsuario = new Usuario({
      nome,
      email,
      senha: senhaHash,
      role: role || 'cliente',
    });

    await novoUsuario.save();

    // Enviar e-mail de boas-vindas
    await enviarEmail(
      email,
      "Bem-vindo à RPA Moçambique!",
      `<h1>Olá ${nome}!</h1>
      <p>Seu cadastro foi realizado com sucesso!</p>
      <p>Agora você pode fazer login na nossa plataforma.</p>`
    );

    res.status(201).json({
      msg: 'Usuário registrado com sucesso',
      usuario: {
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        role: novoUsuario.role
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

// Login normal
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

    const redirectUrl = usuario.role === 'admin' ? '/dashboard/admin' : '/home';

    res.json({
      msg: 'Login bem-sucedido',
      token,
      email: usuario.email, // ✅ corrigido
      usuario: { id: usuario._id, nome: usuario.nome, role: usuario.role },
      redirectUrl,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

// Login via Google
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ msg: 'Token ausente' });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, email_verified, picture } = payload;

    if (!email_verified) {
      return res.status(400).json({ msg: "E-mail não verificado pelo Google" });
    }

    let usuario = await Usuario.findOne({ email });

    if (!usuario) {
      const senhaAleatoria = await bcryptjs.hash(email + Date.now(), 10);
      usuario = new Usuario({
        nome: name,
        email,
        senha: senhaAleatoria,
        role: "cliente",
        avatar: picture,
        googleId: payload.sub
      });
      await usuario.save();

      // Enviar e-mail ao criar conta via Google
      await enviarEmail(
        email,
        "Bem-vindo à RPA Moçambique!",
        `<h1>Olá ${name}!</h1>
        <p>Seu cadastro foi realizado com sucesso via Google!</p>
        <p>Agora você pode fazer login na nossa plataforma.</p>`
      );
    }

    const jwtToken = jwt.sign(
      { id: usuario._id, role: usuario.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      msg: "Login via Google bem-sucedido",
      token: jwtToken,
      email: usuario.email, // ✅ corrigido
      usuario: { id: usuario._id, nome: usuario.nome, email: usuario.email, role: usuario.role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Erro no login via Google", erro: error.message });
  }
});

// Buscar usuários
router.get('/usuarios', async (req, res) => {
  try {
    const { role } = req.query;
    const filtro = role ? { role } : {};
    const usuarios = await Usuario.find(filtro).select('-senha');

    const usuariosFormatados = usuarios.map(({ _id, nome, email, role }) => ({
      id: _id,
      nome,
      email,
      role
    }));

    res.json(usuariosFormatados);
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao buscar usuários', erro: err.message });
  }
});

// Atualizar usuário
router.patch('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nome, senha, email, role } = req.body;

  if (req.usuario.id !== id && req.usuario.role !== 'admin') {
    return res.status(403).json({ msg: 'Acesso negado' });
  }

  try {
    const updateData = {};
    if (nome) updateData.nome = nome;
    if (senha) {
      const salt = await bcryptjs.genSalt(10);
      const senhaHash = await bcryptjs.hash(senha, salt);
      updateData.senha = senhaHash;
    }
    if (email) {
      const emailExistente = await Usuario.findOne({ email });
      if (emailExistente && emailExistente._id.toString() !== id) {
        return res.status(400).json({ msg: 'E-mail já em uso' });
      }
      updateData.email = email;
    }
    if (role && req.usuario.role === 'admin') {
      updateData.role = role;
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

// Deletar usuário
router.delete('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;

  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ msg: 'Acesso negado' });
  }

  try {
    const usuarioRemovido = await Usuario.findByIdAndDelete(id);
    if (!usuarioRemovido) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    res.json({ msg: 'Usuário removido com sucesso' });
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao remover usuário', erro: err.message });
  }
});

// Rota protegida
router.get('/protegida', verificarToken, (req, res) => {
  res.json({ msg: 'Acesso autorizado', usuario: req.usuario });
});

module.exports = router;
