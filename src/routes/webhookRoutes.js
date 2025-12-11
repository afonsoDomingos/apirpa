// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const WebhookConfig = require('../models/webhookConfigModel');
const WebhookLog = require('../models/webhookLogModel');
const webhookNotifier = require('../services/webhookNotifier');
const crypto = require('crypto');

// =====================================================
// 1. CRIAR NOVA CONFIGURAÇÃO DE WEBHOOK
// =====================================================
router.post('/config', verificarToken, async (req, res) => {
    try {
        const { url, eventos, metadata } = req.body;
        const usuarioId = req.usuario.id;

        // Validações
        if (!url) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'URL é obrigatória'
            });
        }

        if (!url.match(/^https?:\/\/.+/)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'URL deve começar com http:// ou https://'
            });
        }

        if (eventos && !Array.isArray(eventos)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Eventos deve ser um array'
            });
        }

        // Verificar limite de webhooks por usuário (máximo 5)
        const count = await WebhookConfig.countDocuments({ usuarioId, ativo: true });
        if (count >= 5) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Limite de 5 webhooks ativos atingido. Desative um webhook existente primeiro.'
            });
        }

        // Criar configuração
        const webhookConfig = new WebhookConfig({
            usuarioId,
            url,
            eventos: eventos || ['payment.approved'],
            metadata: metadata || {},
            secretKey: crypto.randomBytes(32).toString('hex')
        });

        await webhookConfig.save();

        console.log(`✅ Webhook criado: ${webhookConfig._id} → ${url}`);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Webhook configurado com sucesso!',
            webhook: {
                id: webhookConfig._id,
                url: webhookConfig.url,
                eventos: webhookConfig.eventos,
                secretKey: webhookConfig.secretKey,
                ativo: webhookConfig.ativo,
                metadata: webhookConfig.metadata,
                criadoEm: webhookConfig.createdAt
            }
        });

    } catch (error) {
        console.error('❌ Erro ao criar webhook:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao criar webhook',
            erro: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// =====================================================
// 2. LISTAR WEBHOOKS DO USUÁRIO
// =====================================================
router.get('/config', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const webhooks = await WebhookConfig.find({ usuarioId })
            .sort({ createdAt: -1 })
            .select('-__v');

        res.json({
            sucesso: true,
            total: webhooks.length,
            webhooks: webhooks.map(w => ({
                id: w._id,
                url: w.url,
                eventos: w.eventos,
                secretKey: w.secretKey,
                ativo: w.ativo,
                metadata: w.metadata,
                ultimoEnvio: w.ultimoEnvio,
                totalEnvios: w.totalEnvios,
                totalSucesso: w.totalSucesso,
                totalFalhas: w.totalFalhas,
                criadoEm: w.createdAt,
                atualizadoEm: w.updatedAt
            }))
        });

    } catch (error) {
        console.error('❌ Erro ao listar webhooks:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao listar webhooks'
        });
    }
});

// =====================================================
// 3. ATUALIZAR CONFIGURAÇÃO DE WEBHOOK
// =====================================================
router.patch('/config/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { url, eventos, ativo, metadata } = req.body;
        const usuarioId = req.usuario.id;

        const webhook = await WebhookConfig.findOne({ _id: id, usuarioId });

        if (!webhook) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Webhook não encontrado'
            });
        }

        // Atualizar campos
        if (url !== undefined) {
            if (!url.match(/^https?:\/\/.+/)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'URL inválida'
                });
            }
            webhook.url = url;
        }

        if (eventos !== undefined) {
            if (!Array.isArray(eventos)) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Eventos deve ser um array'
                });
            }
            webhook.eventos = eventos;
        }

        if (ativo !== undefined) {
            webhook.ativo = ativo;
        }

        if (metadata !== undefined) {
            webhook.metadata = metadata;
        }

        await webhook.save();

        console.log(`✅ Webhook atualizado: ${webhook._id}`);

        res.json({
            sucesso: true,
            mensagem: 'Webhook atualizado com sucesso!',
            webhook: {
                id: webhook._id,
                url: webhook.url,
                eventos: webhook.eventos,
                ativo: webhook.ativo,
                metadata: webhook.metadata,
                atualizadoEm: webhook.updatedAt
            }
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar webhook:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar webhook'
        });
    }
});

// =====================================================
// 4. DELETAR WEBHOOK
// =====================================================
router.delete('/config/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id;

        const webhook = await WebhookConfig.findOneAndDelete({ _id: id, usuarioId });

        if (!webhook) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Webhook não encontrado'
            });
        }

        console.log(`🗑️ Webhook deletado: ${webhook._id}`);

        res.json({
            sucesso: true,
            mensagem: 'Webhook removido com sucesso!'
        });

    } catch (error) {
        console.error('❌ Erro ao deletar webhook:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao deletar webhook'
        });
    }
});

// =====================================================
// 5. TESTAR WEBHOOK
// =====================================================
router.post('/test', verificarToken, async (req, res) => {
    try {
        const { webhookConfigId } = req.body;
        const usuarioId = req.usuario.id;

        if (!webhookConfigId) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'webhookConfigId é obrigatório'
            });
        }

        const webhook = await WebhookConfig.findOne({
            _id: webhookConfigId,
            usuarioId
        });

        if (!webhook) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Webhook não encontrado'
            });
        }

        // Enviar notificação de teste
        const testPayload = {
            pagamentoId: 'test_' + Date.now(),
            usuarioNome: req.usuario.nome || 'Usuário Teste',
            usuarioEmail: req.usuario.email || 'teste@exemplo.com',
            valor: 150,
            pacote: 'teste',
            metodoPagamento: 'teste',
            tipoPagamento: 'assinatura',
            dataPagamento: new Date(),
            referencia: 'TEST_' + Date.now()
        };

        await webhookNotifier.sendWebhookNotification(
            usuarioId,
            'payment.approved',
            testPayload
        );

        res.json({
            sucesso: true,
            mensagem: 'Notificação de teste enviada! Verifique os logs para detalhes.',
            testPayload
        });

    } catch (error) {
        console.error('❌ Erro ao testar webhook:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao testar webhook'
        });
    }
});

// =====================================================
// 6. VISUALIZAR LOGS DE WEBHOOK
// =====================================================
router.get('/logs', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { limit = 50, evento, webhookConfigId } = req.query;

        const query = { usuarioId };

        if (evento) {
            query.evento = evento;
        }

        if (webhookConfigId) {
            query.webhookConfigId = webhookConfigId;
        }

        const logs = await WebhookLog.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('webhookConfigId', 'url eventos')
            .select('-__v');

        res.json({
            sucesso: true,
            total: logs.length,
            logs: logs.map(log => ({
                id: log._id,
                webhook: log.webhookConfigId ? {
                    id: log.webhookConfigId._id,
                    url: log.webhookConfigId.url,
                    eventos: log.webhookConfigId.eventos
                } : null,
                evento: log.evento,
                url: log.url,
                tentativa: log.tentativa,
                statusCode: log.statusCode,
                sucesso: log.sucesso,
                erro: log.erro,
                tempoResposta: log.tempoResposta,
                criadoEm: log.createdAt
            }))
        });

    } catch (error) {
        console.error('❌ Erro ao buscar logs:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar logs'
        });
    }
});

// =====================================================
// 7. REGENERAR SECRET KEY
// =====================================================
router.post('/config/:id/regenerate-secret', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.usuario.id;

        const webhook = await WebhookConfig.findOne({ _id: id, usuarioId });

        if (!webhook) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Webhook não encontrado'
            });
        }

        // Gerar nova secret key
        webhook.secretKey = crypto.randomBytes(32).toString('hex');
        await webhook.save();

        console.log(`🔑 Secret key regenerada para webhook: ${webhook._id}`);

        res.json({
            sucesso: true,
            mensagem: 'Secret key regenerada com sucesso!',
            secretKey: webhook.secretKey
        });

    } catch (error) {
        console.error('❌ Erro ao regenerar secret key:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao regenerar secret key'
        });
    }
});

module.exports = router;
