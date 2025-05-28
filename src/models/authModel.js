const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const authSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [false, 'O nome nao é obrigatório'],
    trim: true,
    minlength: [3, 'O nome deve ter pelo menos 3 caracteres']
  },
  email: {
    type: String,
    required: [false, 'O e-mail é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'E-mail inválido']
  },
  senha: {
    type: String,
    required: [true, 'A senha é obrigatória'],
    minlength: [6, 'A senha deve ter pelo menos 6 caracteres']
  },
  role: {
    type: String,
    enum: ['admin', 'cliente'],
    default: 'cliente'
  }
}, {
  timestamps: true // Gera createdAt e updatedAt automaticamente
});

// Criptografar a senha antes de salvar
authSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) return next(); // Só criptografa se for nova ou modificada
  this.senha = await bcrypt.hash(this.senha, 10);
  next();
});

// Método para comparar a senha fornecida com a armazenada
authSchema.methods.matchSenha = async function (senhaFornecida) {
  return await bcrypt.compare(senhaFornecida, this.senha);
};

module.exports = mongoose.model('Usuario', authSchema);
