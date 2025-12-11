// models/webhookConfigModel.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const webhookConfigSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    url: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'URL deve começar com http:// ou https://'
        }
    },
    eventos: {
        type: [String],
        required: true,
        enum: [
            'payment.approved',
            'payment.failed',
            'payment.pending',
            'subscription.activated',
            'ad.activated'
        ],
        default: ['payment.approved']
    },
    secretKey: {
        type: String,
        required: true,
        default: () => crypto.randomBytes(32).toString('hex')
    },
    ativo: {
        type: Boolean,
        default: true
    },
    metadata: {
        type: Object,
        default: {}
    },
    ultimoEnvio: {
        type: Date,
        default: null
    },
    totalEnvios: {
        type: Number,
        default: 0
    },
    totalSucesso: {
        type: Number,
        default: 0
    },
    totalFalhas: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Índice composto para buscar webhooks ativos por usuário e evento
webhookConfigSchema.index({ usuarioId: 1, ativo: 1, eventos: 1 });

module.exports = mongoose.model('WebhookConfig', webhookConfigSchema);
