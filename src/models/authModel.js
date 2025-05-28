const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const authSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { 
    type: String, 
    unique: true, 
    required: true, 
    match: [/^\S+@\S+\.\S+$/, 'Por favor, forneça um email válido.']
  },
  senha: { 
    type: String, 
    required: true, 
    minlength: [6, 'A senha deve ter pelo menos 6 caracteres.'] 
  },
  role: { 
    type: String, 
    enum: ['admin', 'cliente'], 
    default: 'cliente' 
  }
});

// Criptografar a senha antes de salvar
authSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, 10);
  next();
});

// Método para comparar a senha fornecida com a senha armazenada
authSchema.methods.matchSenha = async function(senhaFornecida) {
  return await bcrypt.compare(senhaFornecida, this.senha);
};

module.exports = mongoose.model('Usuario', authSchema);

