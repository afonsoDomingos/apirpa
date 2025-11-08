const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  ctaLink: { type: String, required: true, trim: true },
  weeks: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0 }, // Adicionado
  image: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  status: { type: String, enum: ['pending', 'active', 'expired'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Anuncio', anuncioSchema);