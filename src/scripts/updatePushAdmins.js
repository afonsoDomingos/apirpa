require('dotenv').config();
const mongoose = require('mongoose');
const PushSubscription = require('../models/pushSubscriptionModel');
const Usuario = require('../models/usuarioModel');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB conectado.');
    } catch (err) {
        console.error('Erro ao conectar DB:', err);
        process.exit(1);
    }
};

const updatePushSubs = async () => {
    await connectDB();

    try {
        // Encontra todos os usuários que são admin ou SuperAdmin
        const admins = await Usuario.find({
            role: { $in: ['admin', 'SuperAdmin'] }
        }).select('_id email role');

        console.log(`Encontrados ${admins.length} administradores/SuperAdmins.`);

        for (const admin of admins) {
            // Atualiza todas as subscrições desse usuário para isAdmin: true
            const result = await PushSubscription.updateMany(
                { usuarioId: admin._id },
                { $set: { isAdmin: true } }
            );
            console.log(`[${admin.email}] Subscrições atualizadas: ${result.modifiedCount}`);
        }

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

updatePushSubs();
