// models/pagamentoModel.js
const mongoose = require('mongoose');

const pagamentoSchema = new mongoose.Schema({
  usuarioId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true,
    index: true 
  },
  pacote: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true,
    enum: ['free', 'anuncio', 'mensal', 'anual'] // ← adicionado pra não salvar lixo
  },
  metodoPagamento: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true,
    enum: ['gratuito', 'mpesa', 'emola', 'credit_card', 'pix', 'boleto'] // ← validação real
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
    default: 'anuncio',
    lowercase: true, 
    trim: true 
  },
  
  // MANTIDO PRA NÃO QUEBRAR O BANCO (mas nunca usado)
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
    default: Date.now,
    index: true
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  anuncioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anuncio',
    default: null,
    index: true
  }
}, {
  timestamps: true // ← createdAt e updatedAt automático
});

// === BLOQUEIO TOTAL: NUNCA SALVAR CARTÃO (SEGURANÇA 100%) ===
pagamentoSchema.pre('save', function (next) {
  // FORÇA dadosCartao = null SEMPRE
  this.dadosCartao = {
    numero: null,
    nomeTitular: null,
    validade: null,
    cvv: null
  };

  console.log(`[PAGAMENTO] Novo → User: ${this.usuarioId} | ${this.pacote} | ${this.valor} MZN | ${this.metodoPagamento}`);
  if (this.anuncioId) console.log(`   → Anúncio: ${this.anuncioId}`);
  next();
});

pagamentoSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  
  // Ninguém injeta cartão via update
  if (update?.dadosCartao || update?.$set?.dadosCartao) {
    this.set('dadosCartao', { numero: null, nomeTitular: null, validade: null, cvv: null });
  }

  if (update?.status) {
    console.log(`[PAGAMENTO] Status → ${update.status}`);
  }
  next();
});

// === ÍNDICES OTIMIZADOS (sem warning, rápidos) ===
/*pagamentoSchema.index({ usuarioId: 1, dataPagamento: -1 }); // lista "meus pagamentos"
pagamentoSchema.index({ anuncioId: 1 });                    // busca por anúncio
pagamentoSchema.index({ pacote: 1, status: 1 });            // admin filtrar*/

module.exports = mongoose.model('Pagamento', pagamentoSchema);