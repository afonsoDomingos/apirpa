const mongoose = require('mongoose');

const pesquisaLogSchema = new mongoose.Schema({
    termo: {
        type: String,
        required: true
    },
    filtro: {
        type: String,
        required: true
    },
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: false
    },
    data: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('PesquisaLog', pesquisaLogSchema);
