const mongoose = require('mongoose');

// Define o esquema para a solicitação
const solicitacaoSchema = new mongoose.Schema({
  nome_completo: { type: String, required: true },
  contacto: { type: String, required: true },
  tipo_documento: { type: String, required: true },
  motivo: { type: String, required: true },
  afiliacao: { type: String, default: '' }, // Opcional
  local_emissao: { type: String, default: '' }, // Opcional
  data_nascimento: { type: Date, required: true }, // Campo obrigatório
  numero_bi: { type: String, default: '' } // Opcional
}, { timestamps: true });

// Cria o modelo com o esquema
const Solicitacao = mongoose.model('Solicitacao', solicitacaoSchema);

module.exports = Solicitacao;
