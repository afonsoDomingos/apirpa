// models/usuarioModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // ... seus campos de usuário existentes (nome, email, password, role, etc.)
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['cliente', 'admin', 'SuperAdmin'], default: 'cliente' },

    // --- Campos para a Gestão da Assinatura do Usuário ---
    assinaturaAtiva: {
        type: Boolean,
        default: false
    },
    assinaturaExpiracao: {
        type: Date,
        default: null
    },
    pacoteAtual: {
        type: String,
        enum: ['Nenhum', 'Mensal', 'Anual'],
        default: 'Nenhum'
    },
    diasRestantesAssinatura: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

userSchema.virtual('diasRestantes').get(function () {
    if (!this.assinaturaExpiracao || !this.assinaturaAtiva) {
        return 0;
    }
    const hoje = new Date();
    const diffMs = this.assinaturaExpiracao.getTime() - hoje.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// A chave para evitar o OverwriteModelError está aqui:
// Tenta obter o modelo existente; se não existir, o define.
module.exports = mongoose.models.Usuario || mongoose.model('Usuario', userSchema);