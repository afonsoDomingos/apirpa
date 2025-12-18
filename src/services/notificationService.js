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
            badge: '/badge-icon.png',
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
 * Notifica todos os administradores (Tempo Real)
 */
async function notificarAdmin(payload) {
    try {
        const adminSubscriptions = await PushSubscription.find({ isAdmin: true });

        console.log(`🚀 [PUSH] Enviando notificações para ${adminSubscriptions.length} administradores.`);

        const notificationPromises = adminSubscriptions.map(sub => sendPush(sub.subscription, payload));
        await Promise.allSettled(notificationPromises);
    } catch (error) {
        console.error('❌ [PUSH] Erro no serviço de notificação admin:', error);
    }
}

module.exports = { notificarAdmin, sendPush };
