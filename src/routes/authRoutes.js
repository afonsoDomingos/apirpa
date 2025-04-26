const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simulando um banco de dados com um array e usuários pré-criados
let usuarios = [];

// Criando usuários admin e cliente com senhas criptografadas
(async () => {
  const salt = await bcrypt.genSalt(10);

  const adminSenha = await bcrypt.hash('admin123', salt);
  const clienteSenha = await bcrypt.hash('cliente123', salt);

  usuarios.push(
    { id: 1, nome: 'Afonso', email: 'admin1@example.com', senha: adminSenha, role: 'admin' },
    { id: 2, nome: 'Pindula', email: 'admin2@example.com', senha: adminSenha, role: 'admin' },
    { id: 3, nome: 'Armando', email: 'cliente@example.com', senha: clienteSenha, role: 'cliente' },
    { id: 3, nome: 'Tania', email: 'cliente1@example.com', senha: clienteSenha, role: 'cliente' }
  );
})();

// Rota de registro de usuário (POST)
router.post('/register', async (req, res) => {
  const { nome, email, senha, role } = req.body;

  // Verifica se o usuário já existe
  const usuarioExistente = usuarios.find(user => user.email === email);
  if (usuarioExistente) {
    return res.status(400).json({ msg: 'Usuário já existe' });
  }

  // Criptografando a senha
  const salt = await bcrypt.genSalt(10);
  const senhaCriptografada = await bcrypt.hash(senha, salt);

  // Criando novo usuário
  const novoUsuario = {
    id: usuarios.length + 1,
    nome,
    email,
    senha: senhaCriptografada,
    role: role || 'cliente', // Default role é 'cliente'
  };
  usuarios.push(novoUsuario);

  res.status(201).json({ msg: 'Usuário registrado com sucesso', usuario: { id: novoUsuario.id, nome, email, role: novoUsuario.role } });
});

// Rota de login de usuário (POST)
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  // Verifica se o usuário existe
  const usuario = usuarios.find(user => user.email === email);
  if (!usuario) {
    return res.status(400).json({ msg: 'Usuário não encontrado' });
  }

  // Verifica se a senha está correta
  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) {
    return res.status(400).json({ msg: 'Senha incorreta' });
  }

  // Gera o token JWT com o payload
  const token = jwt.sign({ id: usuario.id, role: usuario.role }, process.env.JWT_SECRET || 'seu_jwt_secret', { expiresIn: '1h' });

  // Definindo o redirecionamento com base no role
  let redirectUrl = '';
  if (usuario.role === 'admin') {
    redirectUrl = '/dashboard/admin'; // Redireciona para a Dashboard se for admin
  } else if (usuario.role === 'cliente') {
    redirectUrl = '/home'; // Redireciona para a Home se for cliente
  }

  res.json({
    msg: 'Login bem-sucedido',
    token,
    usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role },
    redirectUrl // Envia a URL de redirecionamento
  });
});

// Middleware de autenticação (para proteger rotas que precisam de login)
const verificarToken = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'Acesso negado. Sem token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seu_jwt_secret');
    req.usuario = decoded;
    next();
  } catch (err) {
    res.status(400).json({ msg: 'Token inválido.' });
  }
};

// Rota para listar usuários (GET) com filtros por 'role' (admin ou cliente)
router.get('/usuarios', (req, res) => {
  const { role } = req.query; // Pega o parâmetro 'role' da URL

  if (role) {
    // Filtra os usuários pelo 'role' se o parâmetro 'role' for fornecido
    const usuariosFiltrados = usuarios.filter(usuario => usuario.role === role);
    return res.json(usuariosFiltrados); // Retorna os usuários filtrados
  }

  // Se não houver filtro, retorna todos os usuários
  res.json(usuarios);
});

module.exports = router;


//http://localhost:5000/api/auth/usuarios
//http://localhost:5000/api/auth/usuarios?role=cliente
//http://localhost:5000/api/auth/usuarios?role=admin
