const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  pacote: { type: String, required: true, lowercase: true, trim: true },
  metodoPagamento: { type: String, required: true, lowercase: true, trim: true },
  telefone: { type: String, default: null, trim: true },
  valor: { type: Number, required: true, min: 0 },
  tipoPagamento: { type: String, default: 'c2b', lowercase: true, trim: true },
  dadosCartao: {
    numero: { type: String, default: null },
    nomeTitular: { type: String, default: null, trim: true },
    validade: { type: String, default: null },
    cvv: { type: String, default: null },
  },
  status: { type: String, default: 'pendente', lowercase: true, trim: true },
  dataPagamento: { type: Date, default: Date.now },

  // NOVO CAMPO: LINK COM ANÚNCIO
  anuncioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anuncio',
    default: null
  }
});

// ÍNDICE PARA QUERIES RÁPIDAS POR TIPO
pagamentoSchema.index({ tipoPagamento: 1, usuarioId: 1 });

// === LOGS ANTES DE SALVAR ===
pagamentoSchema.pre('save', function (next) {
  console.log(`[PagamentoModel] Criando novo pagamento para usuário ${this.usuarioId}`);
  console.log(`→ Método: ${this.metodoPagamento}, Valor: ${this.valor}, Status: ${this.status}`);
  if (this.anuncioId) {
    console.log(`→ Vinculado ao anúncio: ${this.anuncioId}`);
  }
  next();
});

// === LOGS AO ATUALIZAR ===
pagamentoSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update?.status) {
    console.log(`[PagamentoModel] Alterando status do pagamento para: ${update.status}`);
  }
  if (update?.anuncioId) {
    console.log(`[PagamentoModel] Vinculando ao anúncio: ${update.anuncioId}`);
  }
  next();
});

module.exports = mongoose.model('Pagamento', pagamentoSchema);