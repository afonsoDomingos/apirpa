const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ msg: 'Token ausente' });
  }

  // Espera o formato: "Bearer <token>"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ msg: 'Token ausente' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'seu_jwt_secret', (err, decoded) => {
    if (err) {
      return res.status(401).json({ msg: 'Token inválido' });
    }

    // Token válido, salva os dados do usuário na requisição
    req.usuario = { id: decoded.id, role: decoded.role };
    next();
  });
}

module.exports = verificarToken;
