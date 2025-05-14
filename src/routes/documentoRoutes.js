const express = require('express');
const router = express.Router();
const Documento = require('../models/documentoModel');
// Teste de rota
router.get('/', (req, res) => {
  res.send('Rota de documentos funcionando com MongoDB!');
});

// Buscar documentos com filtros (somente reportados)
router.get('/documentos', async (req, res) => {
  const { nome_completo, numero_documento, tipo_documento, provincia } = req.query;
  let filtro = { origem: 'reportado' };

  if (nome_completo) {
    filtro.nome_completo = { $regex: new RegExp(nome_completo, 'i') };
  }
  if (numero_documento) {
    filtro.numero_documento = numero_documento.trim();
  }
  if (tipo_documento) {
    filtro.tipo_documento = { $regex: new RegExp(tipo_documento, 'i') };
  }
  if (provincia) {
    filtro.provincia = { $regex: new RegExp(provincia, 'i') };
  }

  try {
    const resultados = await Documento.find(filtro);
    if (resultados.length === 0) {
      return res.status(404).json({ message: 'Nenhum documento encontrado.' });
    }
    res.status(200).json(resultados);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar documentos.', error: err.message });
  }
});

// Buscar apenas documentos reportados
router.get('/documentos/reportados', async (req, res) => {
  try {
    const documentos = await Documento.find({ origem: 'reportado' });
    res.status(200).json(documentos);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar documentos reportados.', error: err.message });
  }
});

// Buscar apenas documentos de proprietários
router.get('/documentos/proprietarios', async (req, res) => {
  try {
    const documentos = await Documento.find({ origem: 'proprietario' });
    res.status(200).json(documentos);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar documentos de proprietários.', error: err.message });
  }
});

// Cadastrar novo documento
router.post('/documentos', async (req, res) => {
  let { nome_completo, tipo_documento, numero_documento, provincia, data_perda, origem, contacto } = req.body;

  // Limpar espaços
  nome_completo = nome_completo?.trim();
  tipo_documento = tipo_documento?.trim();
  numero_documento = numero_documento?.trim();
  provincia = provincia?.trim();
  contacto = contacto?.trim();

  if (!nome_completo || !tipo_documento || !numero_documento || !provincia || !data_perda || !origem || !contacto) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (!['proprietario', 'reportado'].includes(origem)) {
    return res.status(400).json({ message: 'Origem inválida. Escolha "proprietario" ou "reportado".' });
  }

  try {
    const novoDocumento = new Documento({
      nome_completo,
      tipo_documento,
      numero_documento,
      provincia,
      data_perda: new Date(data_perda).toISOString().split('T')[0],
      origem,
      contacto,
      status: 'Pendente'
    });

    await novoDocumento.save();
    res.status(201).json(novoDocumento);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao cadastrar documento.', error: err.message });
  }
});

// Atualizar documento por ID
router.put('/documentos/:id', async (req, res) => {
  const { id } = req.params;
  const atualizacoes = req.body;

  if (atualizacoes.origem && !['proprietario', 'reportado'].includes(atualizacoes.origem)) {
    return res.status(400).json({ message: 'Origem inválida. Escolha "proprietario" ou "reportado".' });
  }

  if (atualizacoes.data_perda) {
    atualizacoes.data_perda = new Date(atualizacoes.data_perda).toISOString().split('T')[0];
  }

  try {
    const documento = await Documento.findByIdAndUpdate(
      id,
      { $set: atualizacoes },
      { new: true }
    );

    if (!documento) {
      return res.status(404).json({ message: 'Documento não encontrado.' });
    }

    res.status(200).json(documento);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar documento.', error: err.message });
  }
});


// Atualizar status (admin somente)
router.patch('/documentos/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, isAdmin } = req.body;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Apenas administradores podem alterar o status.' });
  }

  if (!['Pendente', 'Entregue'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use "Pendente" ou "Entregue".' });
  }

  try {
    const documento = await Documento.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!documento) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    res.json(documento);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

// Deletar documento por ID
router.delete('/documentos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const documento = await Documento.findByIdAndDelete(id);
    if (!documento) {
      return res.status(404).json({ message: 'Documento não encontrado.' });
    }
    res.status(200).json({ message: 'Documento excluído com sucesso.', documento });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao deletar documento.', error: err.message });
  }
});

// Contar documentos reportados
router.get('/documentos/count', async (req, res) => {
  try {
    const count = await Documento.countDocuments({ origem: 'reportado' });
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao contar documentos.', error: err.message });
  }
});

module.exports = router;
