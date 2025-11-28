// routes/talentosRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const multer = require('multer');
const { storageTalentos } = require('../config/cloudinary');

const Talento = require('../models/Talento');
const Gateway = require('../services/gateway');

const {
  submeterTalento,
  listarTalentos,
  registrarView,
  meuTalentoHoje
} = require('../controllers/TalentoController');

// MULTER NA ROTA (padrão profissional)
const upload = multer({
  storage: storageTalentos,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens!'));
    }
    cb(null, true);
  }
});

// ROTAS

router.post('/submeter', 
  verificarToken, 
  (req, res, next) => {
    express.urlencoded({ extended: true })(req, res, next); // força o parser
  },
  upload.single('foto'), 
  submeterTalento
);


router.get('/lista', listarTalentos);

router.get('/meu', verificarToken, meuTalentoHoje);

router.patch('/view/:id', registrarView);

// PAGAR 10 MT
router.post('/pagar/:talentoId', verificarToken, async (req, res) => {
  const { talentoId } = req.params;
  const usuarioId = req.usuario.id;

  const talento = await Talento.findOne({ _id: talentoId, userId: usuarioId });
  if (!talento) return res.status(404).json({ sucesso: false, mensagem: 'Perfil não encontrado' });
  if (talento.pago) return res.status(400).json({ sucesso: false, mensagem: 'Já pagaste hoje!' });

  const referenciaUnica = `TAL${talentoId}`;

  try {
    const pay = await Gateway.payment('mpesa', req.body.phone, 10, 'mpesa', referenciaUnica);

    talento.pago = true;
    await talento.save();

    const io = req.app.get('io');
    io?.to(usuarioId.toString()).emit('talento:ativado', { sucesso: true });

    if (pay.status === 'success') {
      return res.json({ sucesso: true, mensagem: 'Ativado na hora (sandbox)!' });
    }

    res.json({ sucesso: true, status: 'pendente', mensagem: 'Confirma no telemóvel!' });

  } catch (error) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro no pagamento' });
  }
});

module.exports = router;