const express = require('express');
const router = express.Router();
const Documento = require('../models/documentoModel');
const PesquisaLog = require('../models/pesquisaLogModel');
const verificarToken = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

// Testes básicos
router.get('/', (req, res) => {
  res.send('API funcionando com MongoDB!');
});
router.get('/doc', (req, res) => {
  res.send('Rota de documentos funcionando com MongoDB!');
});

// Buscar documentos do usuário logado
router.get('/documentos/meus', verificarToken, async (req, res) => {
  try {
    const documentos = await Documento.find({ usuario: req.usuario.id });
    res.status(200).json(documentos);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar seus documentos.', error: err.message });
  }
});




// Buscar documentos com filtros (reportados)
router.get('/documentos', async (req, res) => {
  const { nome_completo, numero_documento, tipo_documento, provincia } = req.query;
  let filtro = { origem: 'reportado' };

  if (nome_completo) filtro.nome_completo = { $regex: new RegExp(nome_completo, 'i') };
  if (numero_documento) filtro.numero_documento = numero_documento.trim();
  if (tipo_documento) filtro.tipo_documento = { $regex: new RegExp(tipo_documento, 'i') };
  if (provincia) filtro.provincia = { $regex: new RegExp(provincia, 'i') };

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

// Buscar reportados
router.get('/documentos/reportados', async (req, res) => {
  try {
    const documentos = await Documento.find({ origem: 'reportado' });
    res.status(200).json(documentos);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar documentos reportados.', error: err.message });
  }
});

// Buscar proprietários
router.get('/documentos/proprietarios', async (req, res) => {
  try {
    const documentos = await Documento.find({ origem: 'proprietario' });
    res.status(200).json(documentos);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar documentos de proprietários.', error: err.message });
  }
});



// Criar novo documento
router.post('/documentos', verificarToken, async (req, res) => {
  let { nome_completo, tipo_documento, numero_documento, provincia, data_perda, origem, contacto } = req.body;

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
      data_perda: new Date(data_perda),
      origem,
      contacto,
      status: 'Pendente',
      usuario: req.usuario.id // ✅ corrigido para "usuario"
    });

    await novoDocumento.save();
    res.status(201).json(novoDocumento);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao cadastrar documento.', error: err.message });
  }
});

// Atualizar documento por ID
router.put('/documentos/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const atualizacoes = req.body;

  if (atualizacoes.origem && !['proprietario', 'reportado'].includes(atualizacoes.origem)) {
    return res.status(400).json({ message: 'Origem inválida. Escolha "proprietario" ou "reportado".' });
  }

  if (atualizacoes.data_perda) {
    atualizacoes.data_perda = new Date(atualizacoes.data_perda);
  }

  try {
    const documento = await Documento.findById(id);
    if (!documento) return res.status(404).json({ message: 'Documento não encontrado.' });

    if (documento.usuario.toString() !== req.usuario.id && req.usuario.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    const atualizado = await Documento.findByIdAndUpdate(id, { $set: atualizacoes }, { new: true });
    res.status(200).json(atualizado);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar documento.', error: err.message });
  }
});

// Atualizar status (admin apenas)
router.patch('/documentos/:id/status', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem alterar o status.' });
  }

  if (!['Pendente', 'Entregue'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use "Pendente" ou "Entregue".' });
  }

  try {
    const documento = await Documento.findByIdAndUpdate(id, { status }, { new: true });
    if (!documento) return res.status(404).json({ error: 'Documento não encontrado.' });

    res.json(documento);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status.', message: err.message });
  }
});

// Deletar documento
router.delete('/documentos/:id', verificarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const documento = await Documento.findById(id);
    if (!documento) return res.status(404).json({ message: 'Documento não encontrado.' });

    if (documento.usuario.toString() !== req.usuario.id && req.usuario.role !== 'admin') {
      return res.status(403).json({ message: 'Você não tem permissão para apagar este documento.' });
    }

    await Documento.findByIdAndDelete(id);
    res.status(200).json({ message: 'Documento excluído com sucesso.' });
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

/* ===============================
    MONITORIZAÇÃO DE PESQUISAS
=================================*/

// Rota POST para registar uma pesquisa (Pública)
router.post('/documentos/pesquisas', async (req, res) => {
  const { termo, filtro, data } = req.body;

  if (!termo || !filtro) {
    return res.status(400).json({ message: 'Termo e filtro são obrigatórios.' });
  }

  try {
    let usuarioId = null;

    // Tentar extrair o usuário do token, se presente (opcional)
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seu_jwt_secret');
          usuarioId = decoded.id;
        } catch (err) {
          // Ignora erro de token se for opcional
        }
      }
    }

    const novoLog = new PesquisaLog({
      termo,
      filtro,
      data: data || Date.now(),
      usuario: usuarioId
    });

    await novoLog.save();
    res.status(201).json({ sucesso: true, log: novoLog });
  } catch (err) {
    console.error('Erro ao registar pesquisa:', err);
    res.status(500).json({ message: 'Erro ao registar pesquisa.', error: err.message });
  }
});

// Rota GET para listar todas as pesquisas (Admin apenas)
router.get('/documentos/pesquisas', verificarToken, async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem ver os logs.' });
  }

  try {
    const pesquisas = await PesquisaLog.find()
      .populate('usuario', 'nome email') // Popula dados básicos do usuário
      .sort({ data: -1 });

    res.status(200).json({ sucesso: true, pesquisas });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar logs de pesquisa.', error: err.message });
  }
});

module.exports = router;
