const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Pagamento = require('../models/pagamentoModel');
const Anuncio = require('../models/Anuncio');
const Gateway = require('../services/gateway'); 

// ROTA PRINCIPAL: PROCESSAR PAGAMENTO + ANÚNCIO
router.post('/processar', verificarToken, async (req, res) => {
  let { method, phone, amount, type, pacote, dadosCartao, anuncioData } = req.body;
  const usuarioId = req.usuario.id;

  // Validação
  if (!method || amount === undefined) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Método e valor são obrigatórios.',
    });
  }

  // Validação específica para anúncios
  if (anuncioData && (!anuncioData.name || !anuncioData.description || !anuncioData.price || !anuncioData.ctaLink)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Dados do anúncio incompletos.',
    });
  }

  try {
    // PLANO GRATUITO (opcional para anúncios)
    if (amount === 0 && method === 'gratuito' && pacote === 'free') {
      const anuncio = new Anuncio({
        ...anuncioData,
        weeks: 1,
        amount: 0,
        userId: usuarioId,
        status: 'active',
      });
      await anuncio.save();

      const pagamento = new Pagamento({
        pacote: 'free',
        metodoPagamento: 'gratuito',
        valor: 0,
        telefone: null,
        dadosCartao: null,
        status: 'aprovado',
        usuarioId,
        tipoPagamento: type || 'anuncio',
        dataPagamento: new Date(),
        gatewayResponse: { message: 'Anúncio gratuito ativado' },
        anuncioId: anuncio._id
      });

      await pagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Anúncio gratuito ativado!',
        pagamento,
        anuncio
      });
    }

    // PAGAMENTOS PAGOS (M-Pesa / Emola)
    if (amount > 0) {
      const pay = await Gateway.payment(method, phone, amount, type);

      if (pay.status !== 'success') {
        return res.status(400).json({ 
          sucesso: false, 
          mensagem: 'Pagamento falhou', 
          detalhes: pay 
        });
      }

      // Criar anúncio
      const anuncio = new Anuncio({
        ...anuncioData,
        weeks: anuncioData.weeks || 1,
        amount,
        userId: usuarioId,
        status: 'active', // ativar após pagamento
      });
      await anuncio.save();

      // Salvar pagamento
      const novoPagamento = new Pagamento({
        pacote: pacote || 'anuncio',
        metodoPagamento: method,
        valor: amount,
        telefone: phone || null,
        dadosCartao: dadosCartao || null,
        status: 'aprovado',
        usuarioId,
        tipoPagamento: type || 'anuncio',
        dataPagamento: new Date(),
        gatewayResponse: pay.data || null,
        anuncioId: anuncio._id // LINK COM ANÚNCIO
      });

      const pagamentoSalvo = await novoPagamento.save();

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Pagamento e anúncio ativados com sucesso!',
        pagamento: pagamentoSalvo,
        anuncio
      });
    }

  } catch (error) {
    console.error('Erro ao processar pagamento/anúncio:', error);
    return res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro interno do servidor.' 
    });
  }
});

// LISTAR PAGAMENTOS DO USUÁRIO (COM ANÚNCIOS)
router.get("/meus", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const pagamentos = await Pagamento.find({ usuarioId })
      .sort({ dataPagamento: -1 })
      .populate('anuncioId', 'name image status');

    const hoje = new Date();

    const pagamentosComValidade = pagamentos.map(pag => {
      const validade = new Date(pag.dataPagamento);
      const nomePacote = pag.pacote?.toLowerCase().trim();
      
      let diasDeValidade = 30;
      if (nomePacote === "anual") diasDeValidade = 365;
      else if (nomePacote === "mensal") diasDeValidade = 30;

      validade.setDate(validade.getDate() + diasDeValidade);

      const diffMs = validade - hoje;
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const expirado = diasRestantes < 0;
      const status = expirado ? 'expirado' : 'pago';

      return {
        ...pag._doc,
        validade,
        diasRestantes,
        status,
        anuncio: pag.anuncioId ? {
          id: pag.anuncioId._id,
          name: pag.anuncioId.name,
          image: pag.anuncioId.image,
          status: pag.anuncioId.status
        } : null
      };
    });

    res.json({
      sucesso: true,
      total: pagamentos.length,
      pagamentos: pagamentosComValidade,
    });
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar pagamentos.",
    });
  }
});

// ADMIN: LISTAR TODOS
router.get("/", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamentos = await Pagamento.find()
      .populate("usuarioId", "nome email")
      .populate('anuncioId', 'name image status')
      .sort({ dataPagamento: -1 });

    const hoje = new Date();

    const pagamentosComValidade = pagamentos.map(pag => {
      const validade = new Date(pag.dataPagamento);
      const nomePacote = pag.pacote?.toLowerCase().trim();
      
      let diasDeValidade = 30;
      if (nomePacote === "anual") diasDeValidade = 365;
      else if (nomePacote === "mensal") diasDeValidade = 30;

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
        } : null,
        anuncio: pag.anuncioId ? {
          id: pag.anuncioId._id,
          name: pag.anuncioId.name,
          image: pag.anuncioId.image,
          status: pag.anuncioId.status
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

// BUSCAR POR ID
router.get("/:id", verificarToken, async (req, res) => {
  try {
    const pagamento = await Pagamento.findById(req.params.id)
      .populate('anuncioId', 'name image status');
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

// EXCLUIR (ADMIN)
router.delete("/:id", verificarToken, async (req, res) => {
  if (req.usuario.role !== "admin") {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado." });
  }

  try {
    const pagamento = await Pagamento.findById(req.params.id);
    if (pagamento && pagamento.anuncioId) {
      await Anuncio.findByIdAndUpdate(pagamento.anuncioId, { status: 'paused' });
    }

    const pagamentoRemovido = await Pagamento.findByIdAndDelete(req.params.id);
    if (!pagamentoRemovido) return res.status(404).json({ sucesso: false, mensagem: "Pagamento não encontrado." });

    res.json({ sucesso: true, mensagem: "Pagamento removido com sucesso." });
  } catch (error) {
    console.error("Erro ao remover pagamento:", error);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao remover pagamento." });
  }
});

// VERIFICAR ASSINATURA
router.get("/assinatura/ativa", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const pagamentoMaisRecente = await Pagamento.findOne({ usuarioId }).sort({ dataPagamento: -1 });

    if (!pagamentoMaisRecente) return res.json({ ativa: false, diasRestantes: null });

    const nomePacote = pagamentoMaisRecente.pacote?.toLowerCase().trim();
    let diasDeValidade = 30;
    if (nomePacote === "anual") diasDeValidade = 365;
    else if (nomePacote === "mensal") diasDeValidade = 30;

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