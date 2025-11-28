// controllers/TalentoController.js
const Talento = require('../models/Talento');

// SUBMETER TALENTO (foto já vem processada pelo multer na rota)
const submeterTalento = async (req, res) => {
  try {
    const { nome, descricao, habilidades, disponibilidade, telefone } = req.body;
    const foto = req.file?.path;

    if (!nome || !descricao || !habilidades || !disponibilidade || !telefone || !foto) {
      return res.status(400).json({ sucesso: false, mensagem: 'Todos os campos são obrigatórios' });
    }

    const telefoneLimpo = telefone.replace(/[^0-9]/g, '').replace(/^258/, '');
    if (!/^(84|85|86|87)\d{7}$/.test(telefoneLimpo)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Telefone inválido' });
    }

    // 1 por dia
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const jaSubmeteu = await Talento.findOne({
      userId: req.usuario.id,
      dataSubmissao: { $gte: hoje }
    });

    if (jaSubmeteu) {
      return res.status(400).json({ sucesso: false, mensagem: 'Já submeteste hoje. Volta amanhã!' });
    }

    const novoTalento = new Talento({
      userId: req.usuario.id,
      foto,
      nome: nome.trim(),
      descricao: descricao.trim(),
      habilidades: habilidades.split(',').map(h => h.trim()).filter(Boolean),
      disponibilidade,
      telefone: telefoneLimpo,
      pago: false,
      views: 0
    });

    await novoTalento.save();

    res.status(201).json({
      sucesso: true,
      talentoId: novoTalento._id,
      mensagem: 'Perfil criado! Agora paga 10 MT para aparecer no painel.'
    });

  } catch (error) {
    console.error('[ERRO SUBMETER TALENTO]', error.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno' });
  }
};

// LISTAR TODOS ATIVOS
const listarTalentos = async (req, res) => {
  Talento.find({ pago: true })
    .select('foto nome descricao habilidades disponibilidade telefone views dataSubmissao')
    .sort({ dataSubmissao: -1 })
    .then(talentos => {
      const comWhatsapp = talentos.map(t => ({
        ...t.toObject(),
        whatsappLink: `https://wa.me/258${t.telefone}`
      }));
      res.json(comWhatsapp);
    })
    .catch(() => res.status(500).json({ sucesso: false }));
};

// REGISTRAR VIEW
const registrarView = async (req, res) => {
  try {
    const talento = await Talento.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!talento || !talento.pago) return res.status(404).json({ sucesso: false });

    const io = req.app.get('io');
    io?.to(talento.userId.toString()).emit('talento:view', {
      talentoId: talento._id,
      views: talento.views
    });

    res.json({ sucesso: true, views: talento.views });
  } catch (error) {
    res.status(500).json({ sucesso: false });
  }
};

// MEU PERFIL HOJE
const meuTalentoHoje = async (req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const talento = await Talento.findOne({
      userId: req.usuario.id,
      dataSubmissao: { $gte: hoje }
    });

    if (!talento) return res.json({ sucesso: true, ativo: false });

    res.json({
      sucesso: true,
      ativo: true,
      pago: talento.pago,
      views: talento.views,
      whatsappLink: `https://wa.me/258${talento.telefone}`,
      talento
    });
  } catch (error) {
    res.status(500).json({ sucesso: false });
  }
};

module.exports = {
  submeterTalento,
  listarTalentos,
  registrarView,
  meuTalentoHoje
};