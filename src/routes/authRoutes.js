const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/authModel');
const verificarToken = require('../middleware/authMiddleware');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET não definida nas variáveis de ambiente');
}

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Rota de autenticação funcionando!');
});

// Registro de usuário
router.post('/register', async (req, res) => {
  const { nome, email, senha, role } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ msg: 'Nome, e-mail e senha são obrigatórios' });
  }

  try {
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ msg: 'Usuário já existe' });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const novoUsuario = new Usuario({ nome, email, senha: senhaHash, role: role || 'cliente' });
    await novoUsuario.save();

    res.status(201).json({
      msg: 'Usuário registrado com sucesso',
      usuario: { nome: novoUsuario.nome, email: novoUsuario.email, role: novoUsuario.role },
    });
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor', erro: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { emailOrUsername, senha } = req.body;

  // Validação de campos
  if (!emailOrUsername || !senha) {
    return res.status(400).json({ msg: 'Email ou nome e senha são obrigatórios' });
  }

  try {
    // Busca usuário pelo email ou nome
    const usuario = await Usuario.findOne({
      $or: [
        { email: emailOrUsername },
        { nome: emailOrUsername }
      ]
    });

    if (!usuario) {
      return res.status(400).json({ msg: 'Usuário não encontrado' });
    }

    // Verifica senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(400).json({ msg: 'Senha incorreta' });
    }

    // Gera token JWT
    const token = jwt.sign(
      { id: usuario._id, role: usuario.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Decide redirect
    const redirectUrl = usuario.role === 'admin' ? '/dashboard/admin' : '/home';

    // Retorna dados
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


// Rota para consultar dados do próprio usuário
router.get('/me', verificarToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('-senha');
    if (!usuario) return res.status(404).json({ msg: 'Usuário não encontrado' });
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ msg: 'Erro ao buscar dados', erro: err.message });
  }
});

// Listar usuários
router.get('/usuarios', async (req, res) => {
  try {
    const { role } = req.query;
    const usuarios = await Usuario.find(role ? { role } : {});
    const usuariosFiltrados = usuarios.map(({ _id, nome, email, role }) => ({
      id: _id, nome, email, role
    }));
    res.json(usuariosFiltrados);
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
      const salt = await bcrypt.genSalt(10);
      updateData.senha = await bcrypt.hash(senha, salt);
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

// Rota protegida de teste
router.get('/protegida', verificarToken, (req, res) => {
  res.json({ msg: 'Acesso autorizado', usuario: req.usuario });
});

module.exports = router;
