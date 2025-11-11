// models/Anuncio.js
const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  image: { type: String, default: null },
  description: { type: String, default: 'Anúncio no RecuperaAqui' },
  price: { type: Number, default: 500 },
  ctaLink: { type: String, default: 'https://wa.me/258840000000' }, // MANTÉM O NOME ORIGINAL
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  status: { type: String, enum: ['draft', 'active', 'expired'], default: 'draft' },
  weeks: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Anuncio', anuncioSchema);