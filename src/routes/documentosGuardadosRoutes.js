const express = require('express');
const router = express.Router();
const DocumentosGuardadosModel = require('../models/documentosGuardadosModel');
const verificarToken = require('../middleware/authMiddleware'); 

// Rota de teste
router.get('/teste', (req, res) => {
  res.json({ success: true, message: 'API de documentos pessoais funcionando corretamente!' });
});

// Buscar documentos do usuário logado
router.get('/meus-documentos', verificarToken, async (req, res) => {
  try {
    const documentos = await DocumentosGuardadosModel.find({ usuario: req.usuario.id }).sort({ createdAt: -1 });
    res.json(documentos);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar seus documentos.', error: err.message });
  }
});

// Buscar todos os documentos
router.get('/', async (req, res) => {
  try {
    const documentos = await DocumentosGuardadosModel.find().sort({ createdAt: -1 });
    res.json(documentos);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar documentos.', error: err.message });
  }
});

// Buscar documento por ID
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

// Criar novo documento
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nome, tipoDocumento, numeroDocumento } = req.body;

    if (!nome || !tipoDocumento || !numeroDocumento) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios ausentes: nome, tipoDocumento, numeroDocumento.'
      });
    }

    const novoDocumento = new DocumentosGuardadosModel({
      ...req.body,
      usuario: req.usuario.id // corrigido para 'usuario'
    });

    await novoDocumento.save();
    res.status(201).json(novoDocumento);
  } catch (err) {
    res.status(400).json({ success: false, message: 'Erro ao guardar o documento.', error: err.message });
  }
});

// Atualizar documento por ID
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const documento = await DocumentosGuardadosModel.findById(req.params.id);
    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
    }
    if (documento.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({ success: false, message: 'Sem permissão para atualizar este documento.' });
    }

    // Atualizar somente campos permitidos
    const camposPermitidos = [
      'tipoDocumento', 'nome', 'numeroDocumento', 'dataEmissao', 'validade',
      'categoria', 'matricula', 'seguradora', 'numeroConta', 'numeroCartao',
      'zonaEleitoral', 'numeroSegurancaSocial', 'patente', 'modelo',
      'entidadeEmissora', 'cartaoVirtualTipo', 'codigoVirtual'
    ];

    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        documento[campo] = req.body[campo];
      }
    });

    const documentoAtualizado = await documento.save();

    res.json({ success: true, message: 'Documento atualizado com sucesso.', data: documentoAtualizado });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Erro ao atualizar o documento.', error: err.message });
  }
});

// Deletar documento por ID
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const documento = await DocumentosGuardadosModel.findById(req.params.id);
    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
    }
    if (documento.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({ success: false, message: 'Sem permissão para remover este documento.' });
    }

    await documento.remove();
    res.json({ success: true, message: 'Documento removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao remover o documento.', error: err.message });
  }
});

module.exports = router;
