// services/webhookNotifier.js
const axios = require('axios');
const crypto = require('crypto');
const WebhookConfig = require('../models/webhookConfigModel');
const WebhookLog = require('../models/webhookLogModel');
const emailService = require('./emailService');

class WebhookNotifier {
    /**
     * Envia notificação de webhook para todas as configurações ativas do usuário
     * @param {String} usuarioId - ID do usuário
     * @param {String} evento - Tipo de evento (ex: 'payment.approved')
     * @param {Object} payloadData - Dados do pagamento
     */
    async sendWebhookNotification(usuarioId, evento, payloadData) {
        console.log(`\n📤 [WEBHOOK] Processando notificações para evento: ${evento}`);
        console.log(`👤 Usuário ID: ${usuarioId}`);

        try {
            // 1. Buscar configurações ativas do usuário para este evento
            const webhookConfigs = await WebhookConfig.find({
                usuarioId,
                ativo: true,
                eventos: evento
            });

            if (webhookConfigs.length === 0) {
                console.log('ℹ️ Nenhum webhook configurado para este usuário/evento');
            } else {
                console.log(`✓ ${webhookConfigs.length} webhook(s) encontrado(s)`);
            }

            // 2. Preparar payload
            const payload = {
                evento,
                timestamp: new Date().toISOString(),
                data: payloadData
            };

            // 3. Enviar para cada webhook configurado
            const promises = webhookConfigs.map(config =>
                this.sendToWebhook(config, payload)
            );

            await Promise.allSettled(promises);

            // 4. Notificar admin via email e Socket.IO
            await this.notifyAdmin(payloadData);

            console.log('✅ [WEBHOOK] Processamento concluído\n');

        } catch (error) {
            console.error('❌ [WEBHOOK] Erro ao processar notificações:', error.message);
        }
    }

    /**
     * Envia notificação para um webhook específico com retry
     * @param {Object} webhookConfig - Configuração do webhook
     * @param {Object} payload - Dados a enviar
     */
    async sendToWebhook(webhookConfig, payload) {
        const maxRetries = 3;
        let lastError = null;

        for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
            const startTime = Date.now();

            try {
                console.log(`\n🔄 Tentativa ${tentativa}/${maxRetries} → ${webhookConfig.url}`);

                // Gerar assinatura HMAC
                const signature = this.generateSignature(payload, webhookConfig.secretKey);

                // Enviar requisição HTTP
                const response = await axios.post(webhookConfig.url, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Signature': signature,
                        'X-Webhook-Event': payload.evento,
                        'User-Agent': 'RecuperaAqui-Webhook/1.0'
                    },
                    timeout: 10000 // 10 segundos
                });

                const tempoResposta = Date.now() - startTime;

                // Sucesso!
                console.log(`✅ Webhook enviado com sucesso! (${response.status}) - ${tempoResposta}ms`);

                // Registrar log de sucesso
                await this.logWebhook({
                    webhookConfigId: webhookConfig._id,
                    usuarioId: webhookConfig.usuarioId,
                    evento: payload.evento,
                    url: webhookConfig.url,
                    payload,
                    tentativa,
                    statusCode: response.status,
                    responseBody: JSON.stringify(response.data).substring(0, 1000),
                    sucesso: true,
                    tempoResposta
                });

                // Atualizar estatísticas
                await WebhookConfig.findByIdAndUpdate(webhookConfig._id, {
                    $inc: { totalEnvios: 1, totalSucesso: 1 },
                    ultimoEnvio: new Date()
                });

                return { success: true };

            } catch (error) {
                lastError = error;
                const tempoResposta = Date.now() - startTime;

                console.error(`❌ Tentativa ${tentativa} falhou:`, error.message);

                // Registrar log de falha
                await this.logWebhook({
                    webhookConfigId: webhookConfig._id,
                    usuarioId: webhookConfig.usuarioId,
                    evento: payload.evento,
                    url: webhookConfig.url,
                    payload,
                    tentativa,
                    statusCode: error.response?.status || null,
                    responseBody: error.response?.data ? JSON.stringify(error.response.data).substring(0, 1000) : null,
                    sucesso: false,
                    erro: error.message,
                    tempoResposta
                });

                // Se não for a última tentativa, aguardar antes de tentar novamente (backoff exponencial)
                if (tentativa < maxRetries) {
                    const delay = Math.pow(2, tentativa) * 1000; // 2s, 4s, 8s
                    console.log(`⏳ Aguardando ${delay / 1000}s antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Todas as tentativas falharam
        console.error(`❌ Todas as ${maxRetries} tentativas falharam para ${webhookConfig.url}`);

        // Atualizar estatísticas
        await WebhookConfig.findByIdAndUpdate(webhookConfig._id, {
            $inc: { totalEnvios: 1, totalFalhas: 1 },
            ultimoEnvio: new Date()
        });

        return { success: false, error: lastError?.message };
    }

    /**
     * Gera assinatura HMAC SHA-256 do payload
     * @param {Object} payload - Dados a assinar
     * @param {String} secret - Chave secreta
     * @returns {String} Assinatura no formato "sha256=<hash>"
     */
    generateSignature(payload, secret) {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        return 'sha256=' + hmac.digest('hex');
    }

    /**
     * Registra log de tentativa de webhook
     * @param {Object} logData - Dados do log
     */
    async logWebhook(logData) {
        try {
            const log = new WebhookLog(logData);
            await log.save();
        } catch (error) {
            console.error('❌ Erro ao salvar log de webhook:', error.message);
        }
    }

    /**
     * Notifica admin via email e Socket.IO
     * @param {Object} payloadData - Dados do pagamento
     */
    async notifyAdmin(payloadData) {
        try {
            console.log('\n📧 Enviando notificação ao admin...');

            // 1. Enviar email ao admin
            const emailResult = await emailService.sendPaymentNotificationToAdmin(payloadData);

            if (emailResult.success) {
                console.log('✅ Email enviado ao admin com sucesso');
            } else {
                console.warn('⚠️ Falha ao enviar email ao admin:', emailResult.error);
            }

            // 2. Enviar notificação Socket.IO em tempo real
            // Nota: O io é configurado no server.js e acessível via req.app.get('io')
            // Como este é um serviço, vamos emitir para todos os admins conectados
            const io = global.io; // Será configurado no server.js

            if (io) {
                io.emit('admin:new-payment', {
                    tipo: 'payment.approved',
                    mensagem: `Novo pagamento de ${payloadData.valor} MZN recebido!`,
                    data: payloadData,
                    timestamp: new Date().toISOString()
                });
                console.log('✅ Notificação Socket.IO enviada aos admins');
            }

        } catch (error) {
            console.error('❌ Erro ao notificar admin:', error.message);
        }
    }
}

module.exports = new WebhookNotifier();
