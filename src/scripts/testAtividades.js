require('dotenv').config();
const mongoose = require('mongoose');
const Atividade = require('../models/atividadeModel');
const connectDB = require('../config/db');

async function test() {
    console.log('🚀 Iniciando teste da infraestrutura de Atividades...\n');

    try {
        // 1. Conectar ao Banco
        await connectDB();
        console.log('✅ Conectado ao MongoDB.');

        // 2. Criar uma atividade de teste
        const testUserId = new mongoose.Types.ObjectId(); // Mock user ID
        const novaAtividade = new Atividade({
            setorId: 'ti',
            titulo: 'Teste de Infraestrutura Antigravity',
            descricao: 'Verificando se o model e a conexão com o banco estão funcionando.',
            status: 'Pendente',
            usuario: testUserId
        });

        const salva = await novaAtividade.save();
        console.log('✅ [CREATE] Atividade criada com sucesso:', {
            id: salva._id,
            titulo: salva.titulo,
            status: salva.status
        });

        // 3. Buscar a atividade criada
        const buscada = await Atividade.findById(salva._id);
        if (buscada) {
            console.log('✅ [READ] Atividade recuperada do banco:', buscada.titulo);
        } else {
            throw new Error('Não foi possível encontrar a atividade recém-criada.');
        }

        // 4. Atualizar o status
        buscada.status = 'Concluído';
        const atualizada = await buscada.save();
        console.log('✅ [UPDATE] Atividade atualizada para:', atualizada.status);

        // 5. Deletar (limpeza)
        await Atividade.findByIdAndDelete(salva._id);
        console.log('✅ [DELETE] Atividade de teste removida para limpeza.');

        console.log('\n✨ TESTE CONCLUÍDO COM SUCESSO! ✨');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ ERRO DURANTE O TESTE:', err);
        process.exit(1);
    }
}

test();
