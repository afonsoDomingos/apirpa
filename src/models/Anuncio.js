const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  image: { type: String, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  status: { type: String, enum: ['draft', 'active', 'expired'], default: 'draft' },
  weeks: { type: Number, default: 0, min: 0 },
  amount: { type: Number, default: 0, min: 0 },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Anuncio', anuncioSchema);