const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Usuario = require('../models/authModel');
//const verificarToken = require('../middleware/verificarToken'); // Certifique-se de ter esse middleware
const verificarToken = require('../middleware/authMiddleware');

const router = express.Router();

// Registrar novo usuário
router.post('/register', async (req, res) => {
  const { nome, email, senha, role } = req.body;

  console.log('📥 Registro recebido:', { nome, email, role });
  console.log('Senha recebida:', senha);

  if (!nome || !email || !senha) {
    return res.status(400).json({ msg: 'Nome, e-mail e senha são obrigatórios' });
  }

  try {
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      console.log('❌ Usuário já existe:', email);
      return res.status(400).json({ msg: 'Já existe um usuário com este e-mail' });
    }

    const novoUsuario = new Usuario({
      nome,
      email,
      senha,
      role: role || 'cliente',
    });

    await novoUsuario.save();

    console.log('✅ Novo usuário salvo:', novoUsuario);

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

// Login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  console.log('🔐 Tentativa de login:', email);
  console.log('Senha recebida:', senha);

  if (!email || !senha) {
    return res.status(400).json({ msg: 'E-mail e senha são obrigatórios' });
  }

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      console.log('❌ Usuário não encontrado:', email);
      return res.status(400).json({ msg: 'Usuário não encontrado' });
    }

    const senhaValida = await usuario.matchSenha(senha.trim());

    console.log('Senha válida?', senhaValida);

    if (!senhaValida) {
      console.log('❌ Senha incorreta para o usuário:', email);
      return res.status(400).json({ msg: 'Senha incorreta' });
    }

    const token = jwt.sign(
      { id: usuario._id, role: usuario.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const redirectUrl = usuario.role === 'admin' ? '/dashboard/admin' : '/home';

    console.log('✅ Login bem-sucedido:', { id: usuario._id, role: usuario.role });

    res.json({
      msg: 'Login bem-sucedido',
      token,
      usuario: { id: usuario._id, nome: usuario.nome, role: usuario.role },
      redirectUrl,
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});


// Listar usuários
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

  console.log('✏️ Atualização de usuário:', id);
  console.log('Dados recebidos para atualização:', { nome, email, role });

  if (req.usuario.id !== id && req.usuario.role !== 'admin') {
    console.log('❌ Acesso negado para edição por:', req.usuario);
    return res.status(403).json({ msg: 'Acesso negado' });
  }

  try {
    const updateData = {};
    if (nome) updateData.nome = nome;
    if (senha) {
      const salt = await bcrypt.genSalt(10);
      const senhaHash = await bcrypt.hash(senha, salt);
      console.log('Senha recebida:', senha);
      console.log('Hash gerado:', senhaHash);
      updateData.senha = senhaHash;
    }
    if (email) {
      const emailExistente = await Usuario.findOne({ email });
      if (emailExistente && emailExistente._id.toString() !== id) {
        console.log('❌ E-mail já em uso:', email);
        return res.status(400).json({ msg: 'E-mail já em uso' });
      }
      updateData.email = email;
    }
    if (role && req.usuario.role === 'admin') {
      updateData.role = role;
    }

    const usuarioAtualizado = await Usuario.findByIdAndUpdate(id, updateData, { new: true });
    if (!usuarioAtualizado) return res.status(404).json({ msg: 'Usuário não encontrado' });

    console.log('✅ Usuário atualizado:', usuarioAtualizado);

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
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ msg: 'Erro ao atualizar usuário', erro: err.message });
  }
});

// Deletar usuário
router.delete('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;

  console.log('🗑️ Requisição de remoção de usuário:', id);

  if (req.usuario.role !== 'admin') {
    console.log('❌ Acesso negado para deletar por:', req.usuario.role);
    return res.status(403).json({ msg: 'Acesso negado' });
  }

  try {
    const usuarioRemovido = await Usuario.findByIdAndDelete(id);
    if (!usuarioRemovido) {
      console.log('❌ Usuário não encontrado para deletar:', id);
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    console.log('✅ Usuário removido com sucesso:', usuarioRemovido.email);

    res.json({ msg: 'Usuário removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover usuário:', err);
    res.status(500).json({ msg: 'Erro ao remover usuário', erro: err.message });
  }
});


// Rota protegida de teste
router.get('/protegida', verificarToken, (req, res) => {
  res.json({ msg: 'Acesso autorizado', usuario: req.usuario });
});

module.exports = router;
