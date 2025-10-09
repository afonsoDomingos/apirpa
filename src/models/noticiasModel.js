// models/noticiasModel.js
const mongoose = require('mongoose');

const noticiaSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  resumo: { type: String, required: true },
  conteudo: { type: String, required: true },
  data: { type: Date, default: Date.now },
  imagem: { type: String, default: null },
  visualizacoes: { type: Number, default: 0 }
});

module.exports = mongoose.model('noticiasModel', noticiaSchema);
