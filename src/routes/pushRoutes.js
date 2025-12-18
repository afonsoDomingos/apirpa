const express = require('express');
const router = express.Router();
const PushSubscription = require('../models/pushSubscriptionModel');
const verificarToken = require('../middleware/authMiddleware');

// Rota para obter a chave pública VAPID
router.get('/key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Rota para salvar uma subscrição
router.post('/subscribe', verificarToken, async (req, res) => {
    const { subscription } = req.body;
    const usuarioId = req.usuario.id;
    const isAdmin = req.usuario.role === 'admin';

    try {
        // Remove subscrição antiga do mesmo usuário no mesmo endpoint se existir para evitar duplicatas
        await PushSubscription.deleteOne({ 'subscription.endpoint': subscription.endpoint });

        const novaSubscricao = new PushSubscription({
            usuarioId,
            subscription,
            isAdmin
        });

        await novaSubscricao.save();
        res.status(201).json({ success: true, message: 'Subscrição salva com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar subscrição push:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
