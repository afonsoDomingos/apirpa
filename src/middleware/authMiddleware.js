/// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

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

module.exports = verificarToken;
