// rotas/documentosGuardadosRoutes.js
const express = require('express');
const router = express.Router();
const DocumentosGuardadosModel = require('../models/documentosGuardadosModel');

// Rota de teste
router.get('/teste', (req, res) => {
  res.json({ success: true, message: 'API de documentos pessoais funcionando corretamente!' });
});

// GET: Buscar todos os documentos
router.get('/', async (req, res) => {
  try {
    const documentos = await DocumentosGuardadosModel.find().sort({ createdAt: -1 });
    res.json(documentos);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar documentos.', error: err.message });
  }
});

// GET: Buscar documento por ID
router.get('/:id', async (req, res) => {
  try {
    const documento = await DocumentosGuardadosModel.findById(req.params.id);
    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
    }
    res.json(documento);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar o documento.', error: err.message });
  }
});

// POST: Criar novo documento
router.post('/', async (req, res) => {
  try {
    const { nome, tipoDocumento, numeroDocumento, provincia, contacto } = req.body;

    // Validação básica
    if (!nome || !tipoDocumento || !numeroDocumento) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios ausentes: nome, tipoDocumento, numeroDocumento.'
      });
    }

    const novoDocumento = new DocumentosGuardadosModel(req.body);
    await novoDocumento.save();
    res.status(201).json(novoDocumento);
  } catch (err) {
    res.status(400).json({ success: false, message: 'Erro ao guardar o documento.', error: err.message });
  }
});

// DELETE: Remover documento por ID
router.delete('/:id', async (req, res) => {
  try {
    const documento = await DocumentosGuardadosModel.findByIdAndDelete(req.params.id);
    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
    }
    res.json({ success: true, message: 'Documento removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao remover o documento.', error: err.message });
  }
});

module.exports = router;
