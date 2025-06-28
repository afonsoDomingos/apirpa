const express = require("express");
const router = express.Router();
const Pagamento = require("../models/pagamentoModel");
const verificarToken = require("../middleware/authMiddleware");

// Criar um pagamento (exige token)
router.post("/", verificarToken, async (req, res) => {
  const { pacote, formaPagamento, preco, telefone, dadosCartao } = req.body;
  const usuarioId = req.usuario.id; // id do usuário logado

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
      usuario: usuarioId,
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

// Listar pagamentos do usuário logado
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    const pagamentos = await Pagamento.find({ usuario: usuarioId }).sort({ data: -1 });

    res.json({
      sucesso: true,
      total: pagamentos.length,
      pagamentos,
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

    // Verifica se é dono ou admin
    if (pagamento.usuario.toString() !== req.usuario.id && req.usuario.role !== "admin") {
      return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
    }

    res.json({ sucesso: true, pagamento });
  } catch (error) {
    console.error("Erro ao buscar pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar pagamento." });
  }
});

// Atualizar pagamento por ID (opcional, pode ser só admin)
router.put("/:id", verificarToken, async (req, res) => {
  try {
    // Só admin pode atualizar (ou ajustar conforme regra)
    if (req.usuario.role !== "admin") {
      return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
    }

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

// Deletar pagamento (só admin)
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

module.exports = router;
