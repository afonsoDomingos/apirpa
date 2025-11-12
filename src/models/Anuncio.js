// models/Anuncio.js
const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  ctaLink: { type: String, required: true, trim: true },
  weeks: { type: Number, required: true, min: 1, max: 52 },
  amount: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true,
    index: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'paused', 'expired'], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now },
  ativadoEm: { type: Date } // pra controlar os 10 minutos grátis
}, {
  timestamps: true
});

// Salva data de ativação
anuncioSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'active' && !this.ativadoEm) {
    this.ativadoEm = new Date();
  }
  next();
});

anuncioSchema.index({ userId: 1, status: 1 });
anuncioSchema.index({ status: 1, ativadoEm: 1 });

module.exports = mongoose.model('Anuncio', anuncioSchema);