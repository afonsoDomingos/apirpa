// models/Anuncio.js
const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  ctaLink: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  weeks: {
    type: Number,
    required: true,
    min: 1,
    max: 52,
    default: 1
  },
  amount: {
    type: Number,
    default: 0
  },
  dataAtivacao: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'expired', 'rejected'],
    default: 'pending'
  },

  // === ESTATÍSTICAS REAIS ===
  views: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },

  // Histórico de cliques por dia (máx 30 dias)
  clickHistory: [
    {
      date: {
        type: Date,
        required: true
      },
      clicks: {
        type: Number,
        default: 0
      }
    }
  ],

  featured: {
    type: Boolean,
    default: false
  },

  // Renomeado de dataExpiracao → expiresAt (padrão MongoDB)
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // createdAt e updatedAt automáticos
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// === VIRTUALS (opcional: impressões = views + clicks) ===
anuncioSchema.virtual('impressions').get(function () {
  return (this.views || 0) + (this.clicks || 0);
});

// === ÍNDICES OTIMIZADOS ===
anuncioSchema.index({ userId: 1, status: 1 });
anuncioSchema.index({ status: 1, expiresAt: 1 });
anuncioSchema.index({ featured: 1 });
anuncioSchema.index({ status: 1 });
anuncioSchema.index({ 'clickHistory.date': 1 }); // para buscas no histórico
anuncioSchema.index({ createdAt: -1 }); // listagem recente

// === MIDDLEWARE: Calcular amount e expiresAt ao salvar ===
anuncioSchema.pre('save', function (next) {
  // Calcula amount: 500 MZN por semana
  if (this.isModified('weeks') || this.isNew) {
    this.amount = this.weeks * 500;
  }

  // Calcula data de expiração
  if (this.isModified('weeks') || this.isNew || !this.expiresAt) {
    const start = this.createdAt || new Date();
    this.expiresAt = new Date(start.getTime() + this.weeks * 7 * 24 * 60 * 60 * 1000);
  }

  next();
});

// === MÉTODO ESTÁTICO: Limpar histórico antigo (opcional) ===
anuncioSchema.statics.cleanupOldHistory = async function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.updateMany(
    { 'clickHistory.date': { $lt: thirtyDaysAgo } },
    { $pull: { clickHistory: { date: { $lt: thirtyDaysAgo } } } }
  );
};

module.exports = mongoose.model('Anuncio', anuncioSchema);