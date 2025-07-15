// models/pagamentoModel.js
const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
    // ... seus campos de pagamento aqui ...
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
        type: String
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
        merchantRequestId: { type: String },
        checkoutRequestId: { type: String },
        responseCode: { type: String },
        responseDescription: { type: String },
        customerMessage: { type: String },
        accountReference: { type: String },
        resultCode: { type: String },
        resultDesc: { type: String },
        mpesaReceiptNumber: { type: String },
        transactionDate: { type: String },
        amountConfirmed: { type: Number },
        phoneNumberConfirmed: { type: String },
        mpesaStatus: {
            type: String,
            enum: ['aceito', 'concluido', 'falha', 'revertido'],
            default: 'aceito'
        },
        rawCallback: { type: mongoose.Schema.Types.Mixed },
    },
    diasAdicionados: { type: Number },
    dataExpiracaoAssinatura: { type: Date },
}, {
    timestamps: true
});

// A chave para evitar o OverwriteModelError está aqui:
// Tenta obter o modelo existente; se não existir, o define.
module.exports = mongoose.models.Pagamento || mongoose.model('Pagamento', pagamentoSchema);