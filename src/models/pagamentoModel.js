const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
  
  mpesa: {
  conversationId: String,
  transactionId: String,
  thirdPartyRef: String,
  raw: mongoose.Schema.Types.Mixed,
},
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  pacote: { type: String, required: true },
  formaPagamento: { type: String, required: true },
  preco: { type: Number, required: true },
  telefone: { type: String },
  cartao: {
    numero: String,
    nomeTitular: String,
    validade: String,
    cvv: String,
  },
  status: {
    type: String,
    enum: ['pago', 'pendente', 'cancelado', 'expirado'],
    default: 'pago'
  },
  data: { type: Date, default: Date.now },
});

// Virtual para calcular dias restantes para expirar (30 dias após data)
pagamentoSchema.virtual('diasRestantes').get(function () {
  const hoje = new Date();
  const validade = new Date(this.data);
  validade.setDate(validade.getDate() + 30);

  const diffTime = validade - hoje;
  const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDias;
});

// Virtual para indicar se expirou
pagamentoSchema.virtual('expirado').get(function () {
  return this.diasRestantes < 0;
});

// Incluir virtuais no JSON e objeto
pagamentoSchema.set('toJSON', { virtuals: true });
pagamentoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Pagamento', pagamentoSchema);
