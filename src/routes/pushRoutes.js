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
    const isAdmin = req.usuario.role === 'admin' || req.usuario.role === 'SuperAdmin';

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

// Rota de Diagnóstico: Testar notificação para o usuário atual
router.post('/test', verificarToken, async (req, res) => {
    const usuarioId = req.usuario.id;
    const { notificarAdmin, sendPush } = require('../services/notificationService');

    try {
        console.log(`🔍 [PUSH TEST] Iniciando teste para usuário: ${usuarioId}`);
        const subscription = await PushSubscription.findOne({ usuarioId });

        if (!subscription) {
            console.warn(`⚠️ [PUSH TEST] Nenhuma subscrição encontrada para ${usuarioId}`);
            return res.status(404).json({
                success: false,
                message: 'Nenhuma subscrição ativa encontrada. Por favor, reative as notificações nas configurações.'
            });
        }

        console.log(`✅ [PUSH TEST] Subscrição encontrada. Enviando push de teste...`);

        const payload = {
            title: 'Teste de Notificação 🔔',
            body: 'Se você está vendo isso, suas notificações estão funcionando corretamente!',
            icon: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/uploads/notification-icon.png` : '/uploads/notification-icon.png',
            data: { url: '/settings' }
        };

        const result = await sendPush(subscription.subscription, payload);

        if (result.success) {
            console.log(`✅ [PUSH TEST] Sucesso!`);
            res.json({ success: true, message: 'Notificação enviada com sucesso!' });
        } else {
            console.error(`❌ [PUSH TEST] Falha no envio: ${result.error}`);
            res.status(500).json({ success: false, message: 'Falha ao enviar notificação.', error: result.error });
        }

    } catch (error) {
        console.error('❌ [PUSH TEST] Erro interno:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
