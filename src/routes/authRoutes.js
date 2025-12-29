const express = require('express');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const Usuario = require('../models/authModel');
const verificarToken = require('../middleware/authMiddleware');
const { OAuth2Client } = require('google-auth-library');
const { enviarEmail } = require('../services/emailService');
require('dotenv').config();

const router = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
console.log("✅ GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);

// Função utilitária para gerar JWT
function gerarTokenJWT(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

}

// =======================
// Registrar usuário
// =======================
router.post('/register', async (req, res) => {
  const { nome, email, senha, role } = req.body;
  if (!nome || !email || !senha) {
    console.log("❌ /register - Falha: campos obrigatórios ausentes");
    return res.status(400).json({ msg: 'Nome, e-mail e senha são obrigatórios' });
  }
  try {
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      console.log("❌ /register - E-mail já cadastrado:", email);
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
      `<h1>Olá ${nome}!</h1><p>Seu cadastro foi realizado com sucesso!</p>`
    );

    console.log("✅ /register - Usuário criado:", email);
    return res.status(201).json({
      msg: 'Usuário registrado com sucesso',
      usuario: {
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        role: novoUsuario.role,
      }
    });
  } catch (err) {
    console.error("❌ /register - Erro no servidor:", err);
    return res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

// =======================
// Login com e-mail/senha
// =======================
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    console.log("❌ /login - Falha: e-mail ou senha ausentes");
    return res.status(400).json({ msg: 'E-mail e senha são obrigatórios' });
  }
  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      console.log("❌ /login - Usuário não encontrado:", email);
      return res.status(400).json({ msg: 'Usuário não encontrado' });
    }
    const senhaValida = await usuario.matchSenha(senha.trim());
    if (!senhaValida) {
      console.log("❌ /login - Senha incorreta para:", email);
      return res.status(400).json({ msg: 'Senha incorreta' });
    }

    const token = gerarTokenJWT({ id: usuario._id, role: usuario.role }, '7d');
    const redirectUrl = (usuario.role === 'admin' || usuario.role === 'SuperAdmin') ? '/dashboard/admin' : '/home';

    console.log("✅ /login - Login bem-sucedido:", email);
    return res.json({
      msg: 'Login bem-sucedido',
      token,
      email: usuario.email,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        role: usuario.role,
      },
      redirectUrl
    });
  } catch (err) {
    console.error("❌ /login - Erro no servidor:", err);
    return res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

// =======================
// Login via Google
// =======================
router.post('/google', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    console.log("❌ /google - Token ausente");
    return res.status(400).json({ msg: 'Token ausente' });
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, email_verified, picture } = payload;

    if (!email_verified) {
      console.log("❌ /google - E-mail não verificado:", email);
      return res.status(400).json({ msg: "E-mail não verificado pelo Google" });
    }

    let usuario = await Usuario.findOne({ email });

    if (!usuario) {
      // Cria novo usuário para conta Google
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

      // Enviar e-mail de boas-vindas para novo usuário Google
      await enviarEmail(
        email,
        "Bem-vindo à RPA Moçambique!",
        `<h1>Olá ${name}!</h1><p>Seu cadastro foi realizado com sucesso via Google!</p>`
      );
      console.log("✅ /google - Conta criada via Google:", email);
    } else {
      console.log("✅ /google - Usuário já existente, login via Google:", email);
    }

    const jwtToken = gerarTokenJWT({ id: usuario._id, role: usuario.role }, '7d');
    const redirectUrl = (usuario.role === 'admin' || usuario.role === 'SuperAdmin') ? '/dashboard/admin' : '/home';

    return res.json({
      msg: "Login via Google bem-sucedido",
      token: jwtToken,
      email: usuario.email,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role
      },
      redirectUrl
    });
  } catch (error) {
    console.error("❌ /google - Erro ao autenticar via Google:", error.message);
    return res.status(500).json({ msg: "Erro no login via Google", erro: error.message });
  }
});

// =======================
// Dados do usuário logado (ME)
// =======================
router.get('/me', verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('-senha');
    if (!usuario) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }
    res.json(usuario);
  } catch (err) {
    console.error("❌ GET /me - Erro:", err);
    res.status(500).json({ msg: 'Erro ao buscar perfil', erro: err.message });
  }
});

// =======================
// Obter usuários (ADMIN ONLY)
// =======================
router.get('/usuarios', verificarToken, async (req, res) => {
  if (req.usuario.role !== 'admin' && req.usuario.role !== 'SuperAdmin') {
    return res.status(403).json({ msg: 'Acesso negado: apenas admin' });
  }

  try {
    const { role } = req.query;
    const filtro = role ? { role } : {};
    const usuarios = await Usuario.find(filtro).select('-senha');

    const usuariosFormatados = usuarios.map(u => ({
      id: u._id,
      nome: u.nome,
      email: u.email,
      role: u.role
    }));

    console.log("✅ GET /usuarios - número de usuários:", usuariosFormatados.length);
    return res.json(usuariosFormatados);
  } catch (err) {
    console.error("❌ GET /usuarios - Erro:", err);
    return res.status(500).json({ msg: 'Erro ao buscar usuários', erro: err.message });
  }
});

// =======================
// Atualizar usuário
// =======================
router.patch('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nome, senha, email, role } = req.body;

  // Permissão: admin ou o próprio usuário
  if (req.usuario.id !== id && req.usuario.role !== 'admin' && req.usuario.role !== 'SuperAdmin') {
    console.log("❌ PATCH /usuarios/:id - Acesso negado:", req.usuario, "tentando alterar", id);
    return res.status(403).json({ msg: 'Acesso negado' });
  }

  try {
    const updateData = {};
    if (nome) updateData.nome = nome;
    if (senha) {
      const salt = await bcryptjs.genSalt(10);
      updateData.senha = await bcryptjs.hash(senha, salt);
    }
    if (email) {
      const emailExistente = await Usuario.findOne({ email });
      if (emailExistente && emailExistente._id.toString() !== id) {
        console.log("❌ PATCH /usuarios/:id - E-mail já em uso:", email);
        return res.status(400).json({ msg: 'E-mail já em uso' });
      }
      updateData.email = email;
    }
    if (role && (req.usuario.role === 'admin' || req.usuario.role === 'SuperAdmin')) {
      updateData.role = role;
    }

    const usuarioAtualizado = await Usuario.findByIdAndUpdate(id, updateData, { new: true });
    if (!usuarioAtualizado) {
      console.log("❌ PATCH /usuarios/:id - Usuário não encontrado:", id);
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    console.log("✅ PATCH /usuarios/:id - Atualizado:", id);
    return res.json({
      msg: 'Usuário atualizado',
      usuario: {
        id: usuarioAtualizado._id,
        nome: usuarioAtualizado.nome,
        email: usuarioAtualizado.email,
        role: usuarioAtualizado.role
      }
    });
  } catch (err) {
    console.error("❌ PATCH /usuarios/:id - Erro:", err);
    return res.status(500).json({ msg: 'Erro ao atualizar usuário', erro: err.message });
  }
});

// =======================
// Deletar usuário
// =======================
router.delete('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  if (req.usuario.role !== 'admin' && req.usuario.role !== 'SuperAdmin') {
    console.log("❌ DELETE /usuarios/:id - Acesso negado para:", req.usuario);
    return res.status(403).json({ msg: 'Acesso negado' });
  }
  try {
    const usuarioRemovido = await Usuario.findByIdAndDelete(id);
    if (!usuarioRemovido) {
      console.log("❌ DELETE /usuarios/:id - Usuário não encontrado:", id);
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    console.log("✅ DELETE /usuarios/:id - Removido:", id);
    return res.json({ msg: 'Usuário removido com sucesso' });
  } catch (err) {
    console.error("❌ DELETE /usuarios/:id - Erro:", err);
    return res.status(500).json({ msg: 'Erro ao remover usuário', erro: err.message });
  }
});

// =======================
// Rota protegida de teste
// =======================
router.get('/protegida', verificarToken, (req, res) => {
  console.log("🔐 GET /protegida - Acesso autorizado para:", req.usuario);
  return res.json({ msg: 'Acesso autorizado', usuario: req.usuario });
});

module.exports = router;
