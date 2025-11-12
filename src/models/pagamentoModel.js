// models/pagamentoModel.js
const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  pacote: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    enum: ['free', 'anuncio', 'teste', 'mensal', 'anual'],
    default: 'teste'
  },
  metodoPagamento: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    enum: ['gratuito', 'mpesa', 'emola', 'credit_card', 'pix', 'boleto'],
    default: 'gratuito'
  },
  telefone: { type: String, default: null, trim: true },
  valor: { type: Number, required: true, min: 0 },
  tipoPagamento: {
    type: String,
    enum: ['anuncio', 'assinatura'],
    required: true,
    lowercase: true,
    trim: true,
    default: 'assinatura'
  },
  status: {
    type: String,
    enum: ['pendente', 'aprovado', 'rejeitado', 'reembolsado'],
    default: 'pendente',
    lowercase: true,
    trim: true
  },
  dataPagamento: { type: Date, default: Date.now },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  anuncioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Anuncio', default: null }
}, { timestamps: true });

// Índices úteis
pagamentoSchema.index({ usuarioId: 1, dataPagamento: -1 });
pagamentoSchema.index({ anuncioId: 1 });
pagamentoSchema.index({ pacote: 1, status: 1 });
pagamentoSchema.index({ dataPagamento: -1 });

module.exports = mongoose.model('Pagamento', pagamentoSchema);