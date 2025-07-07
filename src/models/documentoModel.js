// models/documentoModel.js

const mongoose = require('mongoose');

const documentoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }, // ✅ Correto!
  nome_completo: { type: String, required: true, trim: true },
  tipo_documento: { type: String, required: true, trim: true },
  numero_documento: { type: String, required: true, trim: true },
  provincia: { type: String, required: true },
  data_perda: { type: String, required: true },
  origem: { type: String, enum: ['proprietario', 'reportado'], required: true },
  contacto: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['Pendente', 'Entregue'],
    default: 'Pendente'
  }
}, { timestamps: true });

module.exports = mongoose.model('Documento', documentoSchema);
