// routes/anuncios.js
const express = require('express');
const router = express.Router();
const { criarAnuncio, meusAnuncios, anunciosAtivos, processarPagamento } = require('../controllers/anuncioController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/', verificarToken, criarAnuncio);
router.get('/meus', verificarToken, meusAnuncios);
router.get('/ativos', anunciosAtivos);
router.post('/:id/pagar', verificarToken, processarPagamento);

module.exports = router;