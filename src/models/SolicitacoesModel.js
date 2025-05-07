// models/SolicitacoesModel.js
const mongoose = require('mongoose');

const solicitacoesSchema = new mongoose.Schema({
  nome_completo: {
    type: String,
    required: true
  },
  contacto: {
    type: String,
    required: true
  },
  tipo_documento: {
    type: String,
    required: true
  },
  motivo: {
    type: String,
    required: true
  },
  data_criacao: {
    type: Date,
    default: Date.now
  }
});

const SolicitacoesModel = mongoose.model('Solicitacoes', solicitacoesSchema);

module.exports = SolicitacoesModel;

