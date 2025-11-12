const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  pacote: { type: String, required: true, lowercase: true, trim: true }, // garantir lower e trim
  metodoPagamento: { type: String, required: true, lowercase: true, trim: true }, // ex: "mpesa", "emola", "cartao"
  telefone: { type: String, default: null, trim: true },
  valor: { type: Number, required: true, min: 0 },
  tipoPagamento: { type: String, default: 'c2b', lowercase: true, trim: true }, // ou 'b2c'
  dadosCartao: {
    numero: { type: String, default: null },
    nomeTitular: { type: String, default: null, trim: true },
    validade: { type: String, default: null },
    cvv: { type: String, default: null },
  },
  status: { type: String, default: 'pendente', lowercase: true, trim: true }, // pendente, aprovado, recusado
  dataPagamento: { type: Date, default: Date.now }
});

// Logs antes de salvar
pagamentoSchema.pre('save', function (next) {
  console.log(`[PagamentoModel] Criando novo pagamento para usuário ${this.usuarioId}`);
  console.log(`→ Método: ${this.metodoPagamento}, Valor: ${this.valor}, Status inicial: ${this.status}`);
  next();
});

// Logs quando o status é alterado.
pagamentoSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update?.status) {
    console.log(`[PagamentoModel] Alterando status do pagamento para: ${update.status}`);
  }
  next();
});

module.exports = mongoose.model('Pagamento', pagamentoSchema);