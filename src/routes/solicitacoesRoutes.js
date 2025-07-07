const express = require('express');
const router = express.Router();
const SolicitacoesModel = require('../models/SolicitacoesModel');
const verificarToken = require('../middleware/authMiddleware');

// Rota de teste
router.get('/solicitacao', (req, res) => {
  res.send('API de Solicitações funcionando');
});

// Contagem de solicitações
router.get('/solicitacoes/count', async (req, res) => {
  try {
    const count = await SolicitacoesModel.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao contar solicitações', error: error.message });
  }
});

// Criar nova solicitação
router.post('/solicitacoes', verificarToken, async (req, res) => {
  const {
    nome_completo,
    contacto,
    tipo_documento,
    motivo,
    afiliacao,
    local_emissao,
    data_nascimento,
    numero_bi
  } = req.body;

  if (!nome_completo || !contacto || !tipo_documento || !motivo || !data_nascimento) {
    return res.status(400).json({ success: false, message: 'Dados incompletos para solicitação.' });
  }

  try {
    const novaSolicitacao = new SolicitacoesModel({
      nome_completo,
      contacto,
      tipo_documento,
      motivo,
      afiliacao,
      local_emissao,
      data_nascimento,
      numero_bi,
      usuario: req.usuario.id // Alterado para 'usuario' para padronizar
    });

    await novaSolicitacao.save();
    res.status(201).json({ success: true, message: 'Solicitação registrada com sucesso.', data: novaSolicitacao });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao registrar solicitação.', error: err.message });
  }
});

// Listar solicitações do usuário logado
router.get('/minhas-solicitacoes', verificarToken, async (req, res) => {
  try {
    const minhasSolicitacoes = await SolicitacoesModel.find({ usuario: req.usuario.id });
    res.status(200).json(minhasSolicitacoes);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar suas solicitações.', error: err.message });
  }
});

// Listar todas as solicitações
router.get('/solicitacoes', async (req, res) => {
  try {
    const solicitacoes = await SolicitacoesModel.find();
    res.status(200).json(solicitacoes);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar solicitações.', error: err.message });
  }
});

// Buscar solicitação por ID
router.get('/solicitacoes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const solicitacao = await SolicitacoesModel.findById(id);
    if (!solicitacao) {
      return res.status(404).json({ success: false, message: 'Solicitação não encontrada.' });
    }
    res.status(200).json(solicitacao);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao buscar solicitação.', error: err.message });
  }
});

// Atualizar solicitação
router.put('/solicitacoes/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  const {
    nome_completo,
    contacto,
    tipo_documento,
    motivo,
    afiliacao,
    local_emissao,
    data_nascimento,
    numero_bi
  } = req.body;

  if (!nome_completo || !contacto || !tipo_documento || !motivo || !data_nascimento) {
    return res.status(400).json({ success: false, message: 'Dados incompletos para atualizar a solicitação.' });
  }

  try {
    const solicitacao = await SolicitacoesModel.findById(id);
    if (!solicitacao) {
      return res.status(404).json({ success: false, message: 'Solicitação não encontrada.' });
    }

    if (solicitacao.usuario.toString() !== usuarioId) {
      return res.status(403).json({ success: false, message: 'Você não tem permissão para atualizar esta solicitação.' });
    }

    // Atualizar campos permitidos
    solicitacao.nome_completo = nome_completo;
    solicitacao.contacto = contacto;
    solicitacao.tipo_documento = tipo_documento;
    solicitacao.motivo = motivo;
    solicitacao.afiliacao = afiliacao;
    solicitacao.local_emissao = local_emissao;
    solicitacao.data_nascimento = data_nascimento;
    solicitacao.numero_bi = numero_bi;

    const solicitacaoAtualizada = await solicitacao.save();

    res.status(200).json({
      success: true,
      message: 'Solicitação atualizada com sucesso.',
      data: solicitacaoAtualizada
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar a solicitação.', error: err.message });
  }
});

module.exports = router;
