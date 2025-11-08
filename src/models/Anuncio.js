const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  ctaLink: { type: String, required: true },
  weeks: { type: Number, default: 1 },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['active', 'paused'], default: 'paused' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const Anuncio = mongoose.model('Anuncio', anuncioSchema);
console.log('Modelo Anuncio carregado');

module.exports = Anuncio;