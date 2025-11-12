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
    enum: ['free', 'anuncio', 'mensal', 'anual'],
    default: 'free'
  },
  metodoPagamento: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    enum: ['gratuito', 'mpesa', 'emola', 'credit_card', 'pix', 'boleto'],
    default: 'gratuito'
  },
  telefone: {
    type: String,
    default: null,
    trim: true
  },
  valor: {
    type: Number,
    required: true,
    min: 0
  },
  tipoPagamento: {
    type: String,
    enum: ['anuncio', 'assinatura'],
    required: true,
    lowercase: true,
    trim: true,
    default: 'assinatura'
  },
  dadosCartao: {
    numero: { type: String, default: null },
    nomeTitular: { type: String, default: null, trim: true },
    validade: { type: String, default: null },
    cvv: { type: String, default: null },
  },
  status: {
    type: String,
    enum: ['pendente', 'aprovado', 'rejeitado', 'reembolsado'],
    default: 'pendente',
    lowercase: true,
    trim: true
  },
  dataPagamento: {
    type: Date,
    default: Date.now
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  anuncioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anuncio',
    default: null
  }
}, {
  timestamps: true
});

// === SEGURANÇA: NUNCA SALVAR CARTÃO ===
pagamentoSchema.pre('save', function (next) {
  this.dadosCartao = { numero: null, nomeTitular: null, validade: null, cvv: null };
  next();
});

pagamentoSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update?.dadosCartao || update?.$set?.dadosCartao) {
    this.set('dadosCartao', { numero: null, nomeTitular: null, validade: null, cvv: null });
  }
  next();
});

// === ÍNDICES OFICIAIS (SÓ AQUI, NUNCA NO CAMPO) ===
// Removi todos os "index: true" dos campos acima
pagamentoSchema.index({ usuarioId: 1, dataPagamento: -1 });
pagamentoSchema.index({ anuncioId: 1 });
pagamentoSchema.index({ pacote: 1, status: 1 });
pagamentoSchema.index({ tipoPagamento: 1 });
pagamentoSchema.index({ dataPagamento: -1 });
pagamentoSchema.index({ status: 1 });

module.exports = mongoose.model('Pagamento', pagamentoSchema);