const express = require('express');
const router = express.Router();
const SolicitacoesModel = require('../models/SolicitacoesModel');

// Rota de Teste
router.get('/solicitacao', (req, res) => {
  res.send('API de Solicitações funcionando');
});

// Rota para solicitar documento (Create)
router.post('/solicitacoes', async (req, res) => {
  const { nome_completo, contacto, tipo_documento, motivo } = req.body;

  // Valida se todos os dados foram fornecidos
  if (!nome_completo || !contacto || !tipo_documento || !motivo) {
    return res.status(400).json({ message: 'Dados incompletos para solicitação.' });
  }

  try {
    // Cria uma nova solicitação usando o modelo SolicitacoesModel
    const novaSolicitacao = new SolicitacoesModel({
      nome_completo,
      contacto,
      tipo_documento,
      motivo
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
  const { nome_completo, contacto, tipo_documento, motivo } = req.body;

  // Valida se os dados estão presentes
  if (!nome_completo || !contacto || !tipo_documento || !motivo) {
    return res.status(400).json({ message: 'Dados incompletos para atualizar a solicitação.' });
  }

  try {
    // Atualiza a solicitação pelo ID
    const solicitacaoAtualizada = await SolicitacoesModel.findByIdAndUpdate(
      id, 
      { nome_completo, contacto, tipo_documento, motivo },
      { new: true } // Retorna o objeto atualizado
    );

    if (!solicitacaoAtualizada) {
      return res.status(404).json({ message: 'Solicitação não encontrada.' });
    }

    res.status(200).json({ message: 'Solicitação atualizada com sucesso.', solicitacao: solicitacaoAtualizada });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar a solicitação.', error: err.message });
  }
});

// Rota para deletar uma solicitação (Delete)
router.delete('/solicitacoes/:id', async (req, res) => {
  const { id } = req.params; // Obtém o ID da solicitação da URL

  try {
    const solicitacaoDeletada = await SolicitacoesModel.findByIdAndDelete(id); // Deleta a solicitação pelo ID

    if (!solicitacaoDeletada) {
      return res.status(404).json({ message: 'Solicitação não encontrada.' });
    }

    res.status(200).json({ message: 'Solicitação deletada com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao deletar solicitação.', error: err.message });
  }
});

module.exports = router;
