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
    enum: ['teste', 'mensal', 'anual', 'anuncio'],
    required: true
  },
  metodoPagamento: {
    type: String,
    enum: ['mpesa', 'emola', 'card', 'teste'],
    required: true
  },
  valor: {
    type: Number,
    required: true
  },
  telefone: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pendente', 'aprovado', 'falhou', 'cancelado'],
    default: 'pendente'
  },
  tipoPagamento: {
    type: String,
    enum: ['assinatura', 'anuncio'],
    required: true
  },
  dataPagamento: {
    type: Date,
    default: Date.now
  },
  gatewayResponse: {
    type: Object,
    default: {}
  },
  anuncioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anuncio',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Pagamento', pagamentoSchema);