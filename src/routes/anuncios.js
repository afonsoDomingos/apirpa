const express = require('express');
const router = express.Router();
const {
  criarAnuncio,
  meusAnuncios,
  anunciosAtivos,
  atualizarAnuncio,
  removerAnuncio,
  processarPagamento
} = require('../controllers/anuncioController');
const verificarToken = require('../middleware/authMiddleware');

console.log('Rotas de anúncios carregadas');

router.post('/', verificarToken, criarAnuncio);
router.get('/meus', verificarToken, meusAnuncios);
router.get('/ativos', anunciosAtivos);
router.put('/:id', verificarToken, atualizarAnuncio);
router.delete('/:id', verificarToken, removerAnuncio);

// Rota específica para pagar anúncio (integra processarPagamento)
router.post('/:id/pagar', verificarToken, processarPagamento);

module.exports = router;