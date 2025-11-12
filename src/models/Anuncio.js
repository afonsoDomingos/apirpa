// models/Anuncio.js
const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
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
  category: {
    type: String,
    required: true,
    trim: true
  },
  location: {
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
    default: 0 // valor pago (para histórico)
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'expired', 'rejected'],
    default: 'pending',
    index: true
  },
  views: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  dataExpiracao: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// === AUTO-EXPIRAR AO BUSCAR ===
anuncioSchema.pre('findOne', function () {
  this.where({ status: { $in: ['active', 'paused'] } });
});

anuncioSchema.pre('find', function () {
  this.where({ status: { $in: ['active', 'paused'] } });
});

// === ÍNDICES ===
anuncioSchema.index({ userId: 1, status: 1 });
anuncioSchema.index({ status: 1, dataExpiracao: 1 });
anuncioSchema.index({ category: 1 });
anuncioSchema.index({ featured: 1 });

module.exports = mongoose.model('Anuncio', anuncioSchema);