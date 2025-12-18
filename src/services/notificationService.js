const webPush = require('web-push');
const PushSubscription = require('../models/pushSubscriptionModel');

// Configuração das chaves VAPID
webPush.setVapidDetails(
    'mailto:admin@rpa.co.mz', // Substituir pelo email real do admin se necessário
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * Envia uma notificação push para todos os administradores subscritos.
 * @param {Object} payload - O conteúdo da notificação (title, body, etc)
 */
async function notificarAdmin(payload) {
    try {
        const adminSubscriptions = await PushSubscription.find({ isAdmin: true });

        console.log(`Enviando notificações push para ${adminSubscriptions.length} administradores.`);

        const notificationPromises = adminSubscriptions.map(sub => {
            return webPush.sendNotification(
                sub.subscription,
                JSON.stringify(payload)
            ).catch(err => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log('Subscrição expirada ou inválida, removendo...');
                    return PushSubscription.deleteOne({ _id: sub._id });
                }
                console.error('Erro ao enviar notificação push:', err);
            });
        });

        await Promise.all(notificationPromises);
    } catch (error) {
        console.error('Erro no serviço de notificação admin:', error);
    }
}

module.exports = { notificarAdmin };
