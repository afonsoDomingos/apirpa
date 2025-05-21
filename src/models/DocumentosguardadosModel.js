// modelos/documentosGuardadosModel.js
const mongoose = require('mongoose');

const DocumentoSchema = new mongoose.Schema({
  tipoDocumento: { type: String, required: true },
  nome: String,
  numeroDocumento: String,
  dataEmissao: Date,
  validade: Date,
  categoria: String,
  matricula: String,
  seguradora: String,
  numeroConta: String,
  numeroCartao: String,
  zonaEleitoral: String,
  numeroSegurancaSocial: String,
  patente: String,
  modelo: String,
  entidadeEmissora: String,
  cartaoVirtualTipo: String,
  codigoVirtual: String
}, {
  timestamps: true
});

module.exports = mongoose.model('DocumentoGuardado', DocumentoSchema);
