const express = require('express');
const router = express.Router();
const {
  criarAnuncio,
  meusAnuncios,
  anunciosAtivos,
  atualizarAnuncio,
  removerAnuncio,
  // admin
  adminOnly,
  listarTodosAdmin,
  alterarStatusAdmin,
  removerQualquerAdmin,
  registrarClique,
  estatisticasAdmin
} = require('../controllers/anuncioController');
const verificarToken = require('../middleware/authMiddleware');

console.log('Rotas de anúncios carregadas');

// === ROTAS USUÁRIO ===
router.post('/', verificarToken, criarAnuncio);
router.get('/meus', verificarToken, meusAnuncios);
router.get('/ativos', anunciosAtivos);
router.put('/:id', verificarToken, atualizarAnuncio);
router.delete('/:id', verificarToken, removerAnuncio);

// === ROTA DE CLIQUE (pública ou autenticada) ===
router.post('/:id/clique', registrarClique); // ou GET, se preferir


// === ROTAS ADMIN (prefixo /admin) ===
router.get('/admin/anuncios', verificarToken, adminOnly, listarTodosAdmin);
router.patch('/admin/anuncios/:id/status', verificarToken, adminOnly, alterarStatusAdmin);
router.delete('/admin/anuncios/:id', verificarToken, adminOnly, removerQualquerAdmin);
router.get('/admin/anuncios/:id/stats', verificarToken, adminOnly, estatisticasAdmin);
// === ADMIN: LISTAR COM FILTRO ===
router.get('/admin/anuncios', verificarToken, adminOnly, listarTodosAdmin);


module.exports = router;