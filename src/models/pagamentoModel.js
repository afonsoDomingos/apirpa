const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    pacote: {
        type: String,
        required: true
    },
    formaPagamento: {
        type: String,
        required: true,
        enum: ['M-Pesa', 'Cartão', 'Outro'],
        default: 'M-Pesa'
    },
    preco: {
        type: Number,
        required: true
    },
    telefone: {
        type: String,
        validate: {
            validator: v => /^(84|85)\d{7}$/.test(v),
            message: props => `${props.value} não é um número válido M-Pesa.`
        }
    },
    cartao: {
        numeroFinal: String,
        nomeTitular: String,
        validade: String,
        bandeira: String,
        token: String
    },
    status: {
        type: String,
        enum: ['pendente', 'pago', 'falhou', 'cancelado'],
        default: 'pendente'
    },
    data: {
        type: Date,
        default: Date.now
    },
    mpesa: {
        thirdPartyConversationID: { type: String },
        conversationID: { type: String },
        transactionReference: { type: String },
        responseCode: { type: String },
        responseDesc: { type: String },
        resultCode: { type: String },
        resultDesc: { type: String },
        transactionId: { type: String }, // Pode vir como mpesaReceiptNumber
        transactionDate: { type: String },
        amountConfirmed: { type: Number },
        phoneNumberConfirmed: { type: String },
        mpesaStatus: {
            type: String,
            enum: ['aceito', 'concluido', 'falha', 'revertido'],
            default: 'aceito'
        },
        rawCallback: { type: mongoose.Schema.Types.Mixed },
        erro: { type: String },
        log: { type: mongoose.Schema.Types.Mixed }
    },
    diasAdicionados: { type: Number },
    dataExpiracaoAssinatura: { type: Date },
}, {
    timestamps: true
});

module.exports = mongoose.models.Pagamento || mongoose.model('Pagamento', pagamentoSchema);
