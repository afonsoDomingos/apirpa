const express = require("express");
const router = express.Router();
const Pagamento = require("../models/pagamentoModel");
const verificarToken = require("../middleware/authMiddleware");

// Criar um pagamento (requer login)
router.post("/", verificarToken, async (req, res) => {
  const { pacote, formaPagamento, preco, telefone, dadosCartao } = req.body;
  const usuarioId = req.usuario.id;

  if (!pacote || !formaPagamento || preco === undefined || preco === null) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Dados incompletos. Pacote, forma de pagamento e preço são obrigatórios.",
    });
  }

  if (formaPagamento === "Cartão" && !dadosCartao?.numero) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Dados do cartão ausentes.",
    });
  }

  if ((formaPagamento === "M-Pesa" || formaPagamento === "Emola") && !telefone) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Número de telefone ausente.",
    });
  }

  try {
    const novoPagamento = new Pagamento({
      pacote,
      formaPagamento,
      preco,
      telefone: telefone || null,
      cartao: dadosCartao || null,
      data: new Date(),
      usuario: usuarioId,
    });

    const pagamentoSalvo = await novoPagamento.save();

    return res.json({
      sucesso: true,
      mensagem: `Pagamento do pacote ${pacote} via ${formaPagamento} recebido com sucesso.`,
      pagamento: pagamentoSalvo,
    });
  } catch (error) {
    console.error("Erro ao salvar pagamento:", error);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro interno ao processar pagamento.",
    });
  }
});

// Listar pagamentos do usuário logado com virtuais incluídos
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const pagamentos = await Pagamento.find({ usuario: usuarioId }).sort({ data: -1 });

    // Não precisa calcular manualmente, virtuais já vêm com toObject()
    const pagamentosComVirtuais = pagamentos.map((p) => p.toObject());

    res.json({
      sucesso: true,
      total: pagamentosComVirtuais.length,
      pagamentos: pagamentosComVirtuais,
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

    if (pagamento.usuario.toString() !== req.usuario.id && req.usuario.role !== "admin") {
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

// Verificar assinatura ativa (últimos 30 dias)
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const pagamentoMaisRecente = await Pagamento.findOne({ usuario: usuarioId }).sort({ data: -1 });

    if (!pagamentoMaisRecente) {
      return res.json({ ativa: false, diasRestantes: null });
    }

    const diasRestantes = pagamentoMaisRecente.diasRestantes;
    const assinaturaAtiva = diasRestantes >= 0;

    return res.json({ ativa: assinaturaAtiva, diasRestantes });
  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao verificar assinatura." });
  }
});

module.exports = router;
