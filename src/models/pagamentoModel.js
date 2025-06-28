// backend/models/pagamentoModel.js
const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
  pacote: {
    type: String,
    required: true,
  },
  formaPagamento: {
    type: String,
    required: true,
    enum: ['Cartão', 'M-Pesa', 'Emola'],
  },
  preco: {
    type: Number,
    required: true,
    min: 0,
  },
  telefone: {
    type: String,
    required: function() {
      return this.formaPagamento === 'M-Pesa' || this.formaPagamento === 'Emola';
    },
  },
  cartao: {
    numero: String,
    nomeTitular: String,
    validade: String,
    cvv: String,
  },
  data: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Pagamento', pagamentoSchema);
