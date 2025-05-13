const express = require('express');
const router = express.Router();
const SolicitacoesModel = require('../models/SolicitacoesModel');

// Rota de Teste
router.get('/solicitacao', (req, res) => {
  res.send('API de Solicitações funcionando');
});

// ✅ Esta rota deve vir primeiro (contagem de documentos)
router.get('/solicitacoes/count', async (req, res) => {
  try {
    const count = await SolicitacoesModel.countDocuments();  // Usar o modelo correto, no caso, SolicitacoesModel
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao contar solicitações', error: error.message });
  }
});

// Rota para solicitar documento (Create)
router.post('/solicitacoes', async (req, res) => {
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

  // Valida se todos os dados obrigatórios foram fornecidos
  if (!nome_completo || !contacto || !tipo_documento || !motivo || !data_nascimento) {
    return res.status(400).json({ message: 'Dados incompletos para solicitação.' });
  }

  try {
    // Cria uma nova solicitação com todos os dados
    const novaSolicitacao = new SolicitacoesModel({
      nome_completo,
      contacto,
      tipo_documento,
      motivo,
      afiliacao,       // Campo opcional
      local_emissao,   // Campo opcional
      data_nascimento, // Campo obrigatório
      numero_bi        // Campo opcional
    });

    // Salva a solicitação no banco de dados
    await novaSolicitacao.save();

    // Retorna uma resposta de sucesso
    res.status(201).json({ message: 'Solicitação registrada com sucesso.' });
  } catch (err) {
    // Se houver erro ao salvar, retorna o erro
    res.status(500).json({ message: 'Erro ao registrar solicitação.', error: err.message });
  }
});

// Rota para buscar todas as solicitações (Read)
router.get('/solicitacoes', async (req, res) => {
  try {
    const solicitacoes = await SolicitacoesModel.find(); // Busca todas as solicitações
    res.status(200).json(solicitacoes); // Retorna as solicitações em formato JSON
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar solicitações.', error: err.message });
  }
});

// Rota para buscar uma solicitação específica por ID (Read)
router.get('/solicitacoes/:id', async (req, res) => {
  const { id } = req.params; // Obtém o ID da solicitação da URL

  try {
    const solicitacao = await SolicitacoesModel.findById(id); // Busca a solicitação pelo ID
    if (!solicitacao) {
      return res.status(404).json({ message: 'Solicitação não encontrada.' });
    }
    res.status(200).json(solicitacao); // Retorna a solicitação encontrada
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar solicitação.', error: err.message });
  }
});

// Rota para atualizar uma solicitação (Update)
router.put('/solicitacoes/:id', async (req, res) => {
  const { id } = req.params; // Obtém o ID da solicitação da URL
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

  // Valida se os dados obrigatórios estão presentes
  if (!nome_completo || !contacto || !tipo_documento || !motivo || !data_nascimento) {
    return res.status(400).json({ message: 'Dados incompletos para atualizar a solicitação.' });
  }

  try {
    // Atualiza a solicitação pelo ID, incluindo todos os campos novos
    const solicitacaoAtualizada = await SolicitacoesModel.findByIdAndUpdate(
      id,
      {
        nome_completo,
        contacto,
        tipo_documento,
        motivo,
        afiliacao,      // Campo opcional
        local_emissao,  // Campo opcional
        data_nascimento, // Campo obrigatório
        numero_bi       // Campo opcional
      },
      { new: true } // Retorna o objeto atualizado
    );

    if (!solicitacaoAtualizada) {
      return res.status(404).json({ message: 'Solicitação não encontrada.' });
    }

    res.status(200).json({
      message: 'Solicitação atualizada com sucesso.',
      solicitacao: solicitacaoAtualizada
    });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar a solicitação.', error: err.message });
  }
});

module.exports = router;
