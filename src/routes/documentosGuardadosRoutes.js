// rotas/documentosGuardadosRoutes.js
const express = require('express');
const router = express.Router();
const DocumentosGuardados = require('../models/DocumentosGuardadosModel');

// Rota de teste
router.get('/teste', (req, res) => {
  res.json({ mensagem: 'API de documentospessoais funcionando corretamente!' });
});


// GET: Buscar todos os documentos
router.get('/', async (req, res) => {
  try {
    const documentos = await DocumentosGuardados.find().sort({ createdAt: -1 });
    res.json(documentos);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar documentos.' });
  }
});

// POST: Criar novo documento
router.post('/', async (req, res) => {
  try {
    const novoDocumento = new DocumentosGuardados(req.body);
    await novoDocumento.save();
    res.status(201).json(novoDocumento);
  } catch (err) {
    res.status(400).json({ message: 'Erro ao guardar o documento.', erro: err });
  }
});

// DELETE: Remover documento por ID
router.delete('/:id', async (req, res) => {
  try {
    await DocumentosGuardados.findByIdAndDelete(req.params.id);
    res.json({ message: 'Documento removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover o documento.' });
  }
});

module.exports = router;
