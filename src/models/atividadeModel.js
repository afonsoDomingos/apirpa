const mongoose = require('mongoose');

const atividadeSchema = new mongoose.Schema({
    setorId: {
        type: String,
        required: true,
        // ex: 'ceo', 'vendas', 'ti', 'marketing', 'rh'
    },
    titulo: {
        type: String,
        required: true
    },
    descricao: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pendente', 'Em Progresso', 'Concluído'],
        default: 'Pendente'
    },
    data: {
        type: Date,
        default: Date.now
    },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    }
}, {
    timestamps: true
});

// Evitar OverwriteModelError
module.exports = mongoose.models.Atividade || mongoose.model('Atividade', atividadeSchema);
