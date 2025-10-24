const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Gateway = require('../services/gateway'); 

// Rota POST para processar pagamento
router.post('/processar', verificarToken, async (req, res) => {
  let { method, phone, amount, type, pacote, dadosCartao } = req.body;
  const usuarioId = req.usuario.id;

  // Validação: permite amount = 0 para plano gratuito
  if (!pacote || !method || amount === undefined) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Pacote, método e valor são obrigatórios.',
    });
  }

  try {
    // ✅ TRATAMENTO ESPECIAL PARA PLANO GRATUITO
    if (amount === 0 && method === 'gratuito' && pacote === 'free') {
      const novoPagamento = new Pagamento({
        pacote: 'free',
        metodoPagamento: 'gratuito',
        valor: 0,
        telefone: null,
        dadosCartao: null,
        status: 'aprovado',
        usuarioId,
        tipoPagamento: type,
        dataPagamento: new Date(),
        gatewayResponse: { message: 'Plano gratuito ativado' }
      });

      const pagamentoSalvo = await novoPagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Plano gratuito ativado com sucesso.',
        pagamento: pagamentoSalvo,
      });
    }

    // Para pagamentos pagos, processa normalmente
    if (amount > 0) {
      const pay = await Gateway.payment(method, phone, amount, type);

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
        usuarioId,
        tipoPagamento: type,
        dataPagamento: new Date(),
        gatewayResponse: pay.data || null,
      });

      const pagamentoSalvo = await novoPagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Pagamento realizado com sucesso.',
        pagamento: pagamentoSalvo,
      });
    }

  } catch (error) {
    console.error('Erro geral ao processar pagamento:', error);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
});

// Listar pagamentos do usuário logado
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const pagamentos = await Pagamento.find({ usuarioId }).sort({ dataPagamento: -1 });

    const hoje = new Date();

    const pagamentosComValidade = pagamentos.map(pag => {
      const validade = new Date(pag.dataPagamento);
      const nomePacote = pag.pacote?.toLowerCase().trim();
      
      // ✅ PLANO GRATUITO: 30 dias de validade (pode ajustar conforme necessário)
      let diasDeValidade = 30; // default para free
      if (nomePacote === "anual") {
        diasDeValidade = 365;
      } else if (nomePacote === "mensal") {
        diasDeValidade = 30;
      } // free já tem 30 dias

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

// Rota GET para ADMIN: listar todos os pagamentos
router.get("/", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamentos = await Pagamento.find()
      .populate("usuarioId", "nome email")
      .sort({ dataPagamento: -1 });

    const hoje = new Date();

    const pagamentosComValidade = pagamentos.map(pag => {
      const validade = new Date(pag.dataPagamento);
      const nomePacote = pag.pacote?.toLowerCase().trim();
      
      // ✅ Suporte para plano gratuito no admin
      let diasDeValidade = 30; // default para free
      if (nomePacote === "anual") {
        diasDeValidade = 365;
      } else if (nomePacote === "mensal") {
        diasDeValidade = 30;
      }

      validade.setDate(validade.getDate() + diasDeValidade);

      const diffMs = validade - hoje;
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const expirado = diasRestantes < 0;
      const status = expirado ? "expirado" : "pago";

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status,
        usuario: pag.usuarioId ? {
          nome: pag.usuarioId.nome,
          email: pag.usuarioId.email
        } : null
      };
    });

    res.json({
      sucesso: true,
      total: pagamentos.length,
      pagamentos: pagamentosComValidade,
    });

  } catch (error) {
    console.error("Erro ao buscar todos os pagamentos:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar pagamentos." });
  }
});

// Buscar pagamento por ID (dono ou admin)
router.get("/:id", verificarToken, async (req, res) => {
  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });

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
    if (!pagamentoRemovido) return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });

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

    if (!pagamentoMaisRecente) return res.json({ ativa: false, diasRestantes: null });

    const nomePacote = pagamentoMaisRecente.pacote?.toLowerCase().trim();
    let diasDeValidade = 30; // default para free
    
    if (nomePacote === "anual") {
      diasDeValidade = 365;
    } else if (nomePacote === "mensal") {
      diasDeValidade = 30;
    } // free já tem 30 dias

    const validade = new Date(pagamentoMaisRecente.dataPagamento);
    validade.setDate(validade.getDate() + diasDeValidade);

    const hoje = new Date();
    const diffMs = validade - hoje;
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const assinaturaAtiva = diasRestantes >= 0;

    return res.json({ ativa: assinaturaAtiva, diasRestantes });
  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar assinatura." });
  }
});

module.exports = router;