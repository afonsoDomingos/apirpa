const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  pacote: { type: String, required: true },
  metodoPagamento: { type: String, required: true }, // "mpesa", "emola", "cartao"
  telefone: { type: String },
  valor: { type: Number, required: true },
  tipoPagamento: { type: String, default: 'c2b' }, // ou 'b2c'
  dadosCartao: {
    numero: String,
    nomeTitular: String,
    validade: String,
    cvv: String,
  },
  status: { type: String, default: 'pendente' }, // pendente, aprovado, recusado
  dataPagamento: { type: Date, default: Date.now }
});

// Log antes de salvar
pagamentoSchema.pre('save', function (next) {
  console.log(`[PagamentoModel] Criando novo pagamento para usuário ${this.usuarioId}`);
  console.log(`→ Método: ${this.metodoPagamento}, Valor: ${this.valor}, Status inicial: ${this.status}`);
  next();
});

// Log quando o status é alterado
pagamentoSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update?.status) {
    console.log(`[PagamentoModel] Alterando status do pagamento para: ${update.status}`);
  }
  next();
});

module.exports = mongoose.model('Pagamento', pagamentoSchema);
