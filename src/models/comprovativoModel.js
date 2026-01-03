// models/comprovativoModel.js
const mongoose = require('mongoose');

const comprovativoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  metodo_pagamento: {
    type: String,
    enum: ['mpesa', 'emola', 'transferencia_bancaria', 'ponto24', 'outro'],
    required: true
  },
  tipo: {
    type: String,
    enum: ['assinatura', 'anuncio', 'outro'],
    required: true
  },
  valor_pago: {
    type: Number,
    required: true,
    min: 0
  },
  referencia: {
    type: String,
    required: true,
    trim: true
  },
  observacoes: {
    type: String,
    default: null,
    trim: true
  },
  arquivo_path: {
    type: String, // URL do Cloudinary
    required: true
  },
  status: {
    type: String,
    enum: ['pendente', 'em_analise', 'aprovado', 'rejeitado'],
    default: 'pendente'
  },
  observacoes_admin: {
    type: String,
    default: null,
    trim: true
  },
  data_analise: {
    type: Date,
    default: null
  },
  admin_responsavel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  }
}, {
  timestamps: true
});

// Índices para melhor performance
comprovativoSchema.index({ usuarioId: 1, createdAt: -1 });
comprovativoSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Comprovativo', comprovativoSchema);
