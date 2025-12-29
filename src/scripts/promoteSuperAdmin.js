require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/usuarioModel');

// Configuração do DB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB conectado com sucesso!');
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB:', err);
        process.exit(1);
    }
};

const promoteUser = async () => {
    await connectDB();

    const email = 'admin@rpa.com';

    try {
        // Usar updateOne para evitar erro de validação em campos legados
        const result = await Usuario.updateOne(
            { email: email },
            { $set: { role: 'SuperAdmin' } }
        );

        if (result.matchedCount === 0) {
            console.log(`❌ Usuário com email ${email} não encontrado.`);
        } else if (result.modifiedCount === 0) {
            console.log(`⚠️ Usuário encontrado, mas o role já era SuperAdmin ou não mudou.`);
        } else {
            console.log(`✅ Usuário ${email} promovido para SuperAdmin com sucesso!`);
        }

    } catch (error) {
        console.error('Erro ao promover usuário:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Conexão encerrada.');
        process.exit(0);
    }
};

promoteUser();
