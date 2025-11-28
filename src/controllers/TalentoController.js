// controllers/TalentoController.js
const Talento = require('../models/Talento');
const { storageTalentos } = require('../config/cloudinary');
const multer = require('multer');

const upload = multer({
  storage: storageTalentos,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens'));
    cb(null, true);
  }
}).single('foto');

// SUBMETER TALENTO
const submeterTalento = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ sucesso: false, mensagem: err.message });

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
        pago: false
      });

      await novoTalento.save();

      res.status(201).json({
        sucesso: true,
        talentoId: novoTalento._id,
        mensagem: 'Perfil criado! Agora paga 10 MT para aparecer no painel.'
      });
    } catch (error) {
      res.status(500).json({ sucesso: false, mensagem: error.message });
    }
  });
};

// LISTAR TODOS ATIVOS
const listarTalentos = async (req, res) => {
  try {
    const talentos = await Talento.find({ pago: true })
      .select('-userId -pagamentoId -__v')
      .sort({ dataSubmissao: -1 });

    const comWhatsapp = talentos.map(t => ({
      ...t.toObject(),
      whatsappLink: `https://wa.me/258${t.telefone}`
    }));

    res.json(comWhatsapp);
  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: error.message });
  }
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

    req.io?.emit('talento:view', { talentoId: req.params.id, views: talento.views });

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

// EXPORTA TUDO (100% CORRETO)
module.exports = {
  submeterTalento,
  listarTalentos,
  registrarView,
  meuTalentoHoje
};