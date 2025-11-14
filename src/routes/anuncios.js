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
  registrarView,
  registrarClique,
  estatisticasAdmin
} = require('../controllers/anuncioController');

const verificarToken = require('../middleware/authMiddleware');

console.log('Rotas de anúncios carregadas em /api/anuncios');

// === ROTAS PÚBLICAS ===
router.get('/ativos', anunciosAtivos);
router.post('/:id/view', registrarView);
router.post('/:id/clique', registrarClique);

// === ROTAS AUTENTICADAS (USUÁRIO LOGADO) ===
router.use(verificarToken);

router.post('/', criarAnuncio);           // POST /api/anuncios
router.get('/meus', meusAnuncios);         // GET  /api/anuncios/meus
router.put('/:id', atualizarAnuncio);     // PUT  /api/anuncios/123
router.delete('/:id', removerAnuncio);    // DELETE /api/anuncios/123

// === ROTAS ADMIN ===
router.use(adminOnly);

router.get('/admin', listarTodosAdmin);                    // GET    /api/anuncios/admin
router.patch('/admin/:id/status', alterarStatusAdmin);     // PATCH  /api/anuncios/admin/123/status
router.delete('/admin/:id', removerQualquerAdmin);         // DELETE /api/anuncios/admin/123
router.get('/admin/:id/stats', estatisticasAdmin);         // GET    /api/anuncios/admin/123/stats

module.exports = router;