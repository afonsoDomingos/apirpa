const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
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
  data: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Pagamento', pagamentoSchema);
