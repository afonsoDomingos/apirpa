// src/routes/anuncios.js
const express = require('express');
const router = express.Router();

const {
  criarAnuncio,
  meusAnuncios,
  anunciosAtivos,
  atualizarAnuncio,
  removerAnuncio,
  adminOnly,
  listarTodosAdmin,
  alterarStatusAdmin,
  removerQualquerAdmin,
  registrarView,      // ADICIONADO
  registrarClique,
  estatisticasAdmin
} = require('../controllers/anuncioController');

const verificarToken = require('../middleware/authMiddleware');

console.log('Rotas de anúncios carregadas');

// ---------- ROTAS DE USUÁRIO ----------
router.post('/', verificarToken, criarAnuncio);
router.get('/meus', verificarToken, meusAnuncios);
router.get('/ativos', anunciosAtivos);
router.put('/:id', verificarToken, atualizarAnuncio);
router.delete('/:id', verificarToken, removerAnuncio);

// ROTAS DE ESTATÍSTICAS (PÚBLICAS, MAS SÓ CONTAM SE ATIVO)
router.post('/:id/view', registrarView);        // ADICIONADO
router.post('/:id/clique', registrarClique);    // CORRIGIDO: era /click → /clique

// ---------- ROTAS DE ADMIN ----------
router.get('/admin/anuncios', verificarToken, adminOnly, listarTodosAdmin);
router.patch('/admin/anuncios/:id/status', verificarToken, adminOnly, alterarStatusAdmin);
router.delete('/admin/anuncios/:id', verificarToken, adminOnly, removerQualquerAdmin);
router.get('/admin/anuncios/:id/stats', verificarToken, adminOnly, estatisticasAdmin);

module.exports = router;