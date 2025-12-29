const webPush = require('web-push');
const PushSubscription = require('../models/pushSubscriptionModel');

// 🔐 Configuração do Push Server (VAPID)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('⚠️ [PUSH SERVER] Chaves VAPID ausentes no .env. Notificações Push desativadas.');
} else {
    webPush.setVapidDetails(
        'mailto:suporte@recuperaaqui.co.mz',
        vapidPublicKey,
        vapidPrivateKey
    );
}

/**
 * Envia uma notificação push genérica
 * @param {Object} subscription - Objeto de subscrição do navegador
 * @param {Object} payload - Dados da notificação (title, body, icon, data)
 */
async function sendPush(subscription, payload) {
    try {
        await webPush.sendNotification(subscription, JSON.stringify({
            ...payload,
            badge: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/uploads/notification-icon.png` : '/uploads/notification-icon.png',
            vibrate: [100, 50, 100]
        }));
        return { success: true };
    } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
            console.log('🗑️ [PUSH] Subscrição expirada ou inválida, removendo...');
            await PushSubscription.deleteOne({ 'subscription.endpoint': subscription.endpoint });
        } else {
            console.error('❌ [PUSH] Erro ao enviar notificação:', error.message);
        }
        return { success: false, error: error.message };
    }
}

/**
 * Notifica todos os administradores (Tempo Real via Push e Socket.IO)
 */
async function notificarAdmin(payload) {
    try {
        // ---- 1. WEB PUSH NOTIFICATION ----
        const adminSubscriptions = await PushSubscription.find({ isAdmin: true });
        console.log(`🚀 [PUSH SERVER] Enviando para ${adminSubscriptions.length} administradores.`);

        const notificationPromises = adminSubscriptions.map(sub => sendPush(sub.subscription, payload));

        // ---- 2. SOCKET.IO REAL-TIME (SE ESTIVER CONECTADO) ----
        const io = global.io;
        if (io) {
            const clientCount = io.engine.clientsCount;
            console.log(`⚡ [SOCKET.IO] Tentando emitir admin:new-payment para ${clientCount} clientes conectados.`);

            io.emit('admin:new-payment', {
                sucesso: true,
                timestamp: new Date().toISOString(),
                ...payload
            });
        } else {
            console.warn('⚠️ [SOCKET.IO] Instância io não encontrada em global.io .');
        }

        await Promise.allSettled(notificationPromises);
    } catch (error) {
        console.error('❌ [NOTIFICATION SERVICE] Erro ao notificar admin:', error);
    }
}

module.exports = { notificarAdmin, sendPush };
