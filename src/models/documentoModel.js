const mongoose = require('mongoose');

const documentoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  nome_completo: {
    type: String,
    required: true,
    trim: true
  },
  tipo_documento: {
    type: String,
    required: true,
    trim: true
  },
  numero_documento: {
    type: String,
    required: true,
    trim: true
  },
  provincia: {
    type: String,
    required: true,
    trim: true
  },
  data_perda: {
    type: Date, // ✅ agora é tipo Date
    required: true
  },
  origem: {
    type: String,
    enum: ['proprietario', 'reportado'],
    required: true
  },
  contacto: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Pendente', 'Entregue'],
    default: 'Pendente'
  }
}, { timestamps: true });

// ✅ Índices para melhorar buscas
documentoSchema.index({ origem: 1 });
documentoSchema.index({ tipo_documento: 1 });
documentoSchema.index({ provincia: 1 });
documentoSchema.index({ nome_completo: 'text' });

// ✅ Índice composto opcional para evitar duplicatas
// documentoSchema.index({ tipo_documento: 1, numero_documento: 1 }, { unique: true });

module.exports = mongoose.model('Documento', documentoSchema);
