const express = require('express');
const router = express.Router();
const {
  criarAnuncio,
  meusAnuncios,
  anunciosAtivos,
  removerAnuncio,
} = require('../controllers/anuncioController');
const verificarToken = require('../middleware/authMiddleware');

console.log('Rotas de anúncios carregadas');

router.post('/', verificarToken, criarAnuncio);
router.get('/meus', verificarToken, meusAnuncios);
router.get('/ativos', anunciosAtivos);
router.delete('/:id', verificarToken, removerAnuncio);

module.exports = router;