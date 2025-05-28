const verificarToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Pega o token após "Bearer "

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
