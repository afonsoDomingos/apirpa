const express = require("express");
const router = express.Router();
const Pagamento = require('../models/pagamentoModel');

// Rota de teste simples
router.get("/teste", (req, res) => {
  res.json({ sucesso: true, mensagem: "API de pagamentos funcionando normalmente!" });
});

// POST - Criar um pagamento
router.post("/", async (req, res) => {
  const { pacote, formaPagamento, preco, telefone, dadosCartao } = req.body;

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
    });

    const pagamentoSalvo = await novoPagamento.save();

    console.log("📥 Novo pagamento salvo:", pagamentoSalvo);

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

// GET - Listar pagamentos com filtro opcional e paginação
router.get("/", async (req, res) => {
  const { pacote, formaPagamento, pagina = 1, limite = 10 } = req.query;
  const filtro = {};
  if (pacote) filtro.pacote = pacote;
  if (formaPagamento) filtro.formaPagamento = formaPagamento;

  const skip = (pagina - 1) * limite;

  try {
    const total = await Pagamento.countDocuments(filtro);
    const pagamentos = await Pagamento.find(filtro)
      .sort({ data: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limite));

    res.json({
      sucesso: true,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      total,
      pagamentos,
    });
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar pagamentos.",
    });
  }
});

// GET - Buscar pagamento por ID
router.get("/:id", async (req, res) => {
  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (!pagamento) {
      return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });
    }
    res.json({ sucesso: true, pagamento });
  } catch (error) {
    console.error("Erro ao buscar pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar pagamento." });
  }
});

// PUT - Atualizar pagamento por ID
router.put("/:id", async (req, res) => {
  try {
    const pagamentoAtualizado = await Pagamento.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!pagamentoAtualizado) {
      return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });
    }
    res.json({ sucesso: true, pagamento: pagamentoAtualizado });
  } catch (error) {
    console.error("Erro ao atualizar pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar pagamento." });
  }
});

// DELETE - Deletar pagamento por ID
router.delete("/:id", async (req, res) => {
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

module.exports = router;
