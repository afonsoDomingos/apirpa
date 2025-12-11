// models/webhookLogModel.js
const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
    webhookConfigId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WebhookConfig',
        required: true,
        index: true
    },
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    evento: {
        type: String,
        required: true,
        enum: [
            'payment.approved',
            'payment.failed',
            'payment.pending',
            'subscription.activated',
            'ad.activated'
        ]
    },
    url: {
        type: String,
        required: true
    },
    payload: {
        type: Object,
        required: true
    },
    tentativa: {
        type: Number,
        required: true,
        min: 1,
        max: 3,
        default: 1
    },
    statusCode: {
        type: Number,
        default: null
    },
    responseBody: {
        type: String,
        default: null
    },
    sucesso: {
        type: Boolean,
        required: true,
        default: false
    },
    erro: {
        type: String,
        default: null
    },
    tempoResposta: {
        type: Number, // em milissegundos
        default: null
    }
}, {
    timestamps: true
});

// Índice composto para buscar logs por webhook e evento
webhookLogSchema.index({ webhookConfigId: 1, evento: 1, createdAt: -1 });
webhookLogSchema.index({ usuarioId: 1, createdAt: -1 });

// TTL index - logs expiram após 90 dias
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
