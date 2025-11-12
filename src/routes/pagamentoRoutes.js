const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
// Corrigido nome do serviço Gateway (antes getway)
const Gateway = require('../services/gateway'); 

// Rota POST para processar pagamento
router.post('/processar', verificarToken, async (req, res) => {
  let { method, phone, amount, type, pacote, dadosCartao } = req.body;
  const usuarioId = req.usuario.id;

  console.log(`Recebendo solicitação de pagamento para o usuário ${usuarioId}`);

  // Validação básica dos campos obrigatórios
  if (!pacote || !method || !amount) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Pacote, método e valor são obrigatórios.',
    });
  }

  // Sanitize entrada
  method = method.toLowerCase();
  type = type ? type.toLowerCase() : null;
  pacote = pacote.toLowerCase().trim();

  // Validar amount (deve ser número positivo)
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Valor inválido para pagamento.',
    });
  }

  // Validação telefone para pagamentos que precisam
  if ((method === 'mpesa' || method === 'emola') && !phone) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Telefone ausente para pagamento via ${method}.`,
    });
  }

  try {
    // Executa pagamento via gateway
    const pay = await Gateway.payment(method, phone, amount, type);
    console.log('Resposta do Gateway:', pay);

    if (pay.status !== 'success') {
      return res.status(400).json({ sucesso: false, mensagem: 'Pagamento falhou', detalhes: pay });
    }

    const novoPagamento = new Pagamento({
      pacote,
      metodoPagamento: method,
      valor: amount,
      telefone: phone || null,
      
      dadosCartao: dadosCartao || null,
      status: 'aprovado',
      usuarioId: usuarioId, // campo consistente com o modelo
      tipoPagamento: type,
      dataPagamento: new Date(),
      gatewayResponse: pay.data || null,
    });

    const pagamentoSalvo = await novoPagamento.save();

    console.log('Pagamento realizado com sucesso e salvo no DB.');

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Pagamento realizado com sucesso.',
      pagamento: pagamentoSalvo,
    });

  } catch (error) {
    console.error('Erro geral ao processar pagamento:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
});

// Listar pagamentos do usuário logado com validade e status dinâmico
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    // Busca com campo correto (usuarioId)
    const pagamentos = await Pagamento.find({ usuarioId }).sort({ dataPagamento: -1 });

    const hoje = new Date();

    const pagamentosComValidade = pagamentos.map(pag => {
      const validade = new Date(pag.dataPagamento);
      const nomePacote = pag.pacote?.toLowerCase().trim();
      const diasDeValidade = nomePacote === "anual" ? 365 : 30;

      validade.setDate(validade.getDate() + diasDeValidade);

      const diffMs = validade - hoje;
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const expirado = diasRestantes < 0;
      const status = expirado ? 'expirado' : 'pago';

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status
      };
    });

    res.json({
      sucesso: true,
      total: pagamentos.length,
      pagamentos: pagamentosComValidade,
    });
  } catch (error) {
    console.error("Erro ao buscar pagamentos do usuário:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar pagamentos.",
    });
  }
});

// Buscar pagamento por ID (só dono ou admin)
router.get("/:id", verificarToken, async (req, res) => {
  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) {
      return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });
    }

    if (pagamento.usuarioId.toString() !== req.usuario.id && req.usuario.role !== "admin") {
      return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
    }

    res.json({ sucesso: true, pagamento: pagamento.toObject() });
  } catch (error) {
    console.error("Erro ao buscar pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar pagamento." });
  }
});

// Excluir pagamento (admin)
router.delete("/:id", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamentoRemovido = await Pagamento.findByIdAndDelete(req.params.id);
    if (!pagamentoRemovido) {
      return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });
    }
    res.json({ sucesso: true, mensagem: "Pagamento removido com sucesso." });
  } catch (error) {
    console.error("Erro ao remover pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao remover pagamento." });
  }
});

// Verificar assinatura ativa
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const pagamentoMaisRecente = await Pagamento.findOne({ usuarioId }).sort({ dataPagamento: -1 });

    if (!pagamentoMaisRecente) {
      return res.json({ ativa: false, diasRestantes: null });
    }

    const nomePacote = pagamentoMaisRecente.pacote?.toLowerCase().trim();
    const diasDeValidade = nomePacote === "anual" ? 365 : 30;

    const validade = new Date(pagamentoMaisRecente.dataPagamento);
    validade.setDate(validade.getDate() + diasDeValidade);

    const hoje = new Date();
    const diffMs = validade - hoje;
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const assinaturaAtiva = diasRestantes >= 0;

    return res.json({ ativa: assinaturaAtiva, diasRestantes });
  } catch (error) {
    console.error("Erro ao tentar verificar assinatura:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar assinatura." });
  }
});

module.exports = router;