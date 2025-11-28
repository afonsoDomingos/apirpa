// models/Talento.js
const mongoose = require('mongoose');

const talentoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  foto: {
    type: String,
    required: true
  },
  nome: {
    type: String,
    required: true,
    trim: true
  },
  descricao: {
    type: String,
    required: true,
    maxlength: 150
  },
  habilidades: [{
    type: String
  }],
  disponibilidade: {
    type: String,
    enum: ['Imediata', '1 semana', '2 semanas', '1 mês'],
    required: true
  },
  telefone: {
    type: String,
    required: true,
    match: /^(84|85|86|87)\d{7}$/
  },
  pago: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  dataSubmissao: {
    type: Date,
    default: Date.now
  }
});

// Índice para garantir 1 por dia por usuário
talentoSchema.index({ userId: 1, dataSubmissao: 1 });

module.exports = mongoose.model('Talento', talentoSchema);