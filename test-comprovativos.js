// ============================================
// TESTE DA API DE COMPROVATIVOS
// ============================================
// Este arquivo contém exemplos de como testar
// todas as rotas da API de comprovativos
// ============================================

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Configuração base
const API_URL = 'http://localhost:5000'; // ou sua URL de produção
let userToken = 'SEU_TOKEN_DE_USUARIO_AQUI';
let adminToken = 'SEU_TOKEN_DE_ADMIN_AQUI';

// ============================================
// 1. TESTE: ENVIAR COMPROVATIVO (Usuário)
// ============================================
async function testarEnviarComprovativo() {
    console.log('\n🧪 TESTE 1: Enviar Comprovativo');
    console.log('=====================================');

    const formData = new FormData();

    // Anexar arquivo (certifique-se de ter um arquivo de teste)
    formData.append('comprovativo', fs.createReadStream('./test-comprovativo.jpg'));

    // Adicionar dados do formulário
    formData.append('metodo_pagamento', 'mpesa');
    formData.append('tipo', 'assinatura');
    formData.append('valor_pago', '150');
    formData.append('referencia', 'MPE' + Date.now());
    formData.append('observacoes', 'Teste de envio de comprovativo via API');

    try {
        const response = await axios.post(
            `${API_URL}/api/comprovativos/enviar`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${userToken}`
                }
            }
        );

        console.log('✅ Sucesso!');
        console.log('Status:', response.status);
        console.log('Resposta:', JSON.stringify(response.data, null, 2));

        return response.data.comprovativo.id; // Retorna ID para próximos testes
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
        return null;
    }
}

// ============================================
// 2. TESTE: LISTAR MEUS COMPROVATIVOS (Usuário)
// ============================================
async function testarListarMeusComprovativos() {
    console.log('\n🧪 TESTE 2: Listar Meus Comprovativos');
    console.log('=====================================');

    try {
        const response = await axios.get(
            `${API_URL}/api/comprovativos/meus`,
            {
                headers: {
                    'Authorization': `Bearer ${userToken}`
                }
            }
        );

        console.log('✅ Sucesso!');
        console.log('Total:', response.data.total);
        console.log('Comprovativos:', JSON.stringify(response.data.comprovativos, null, 2));
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

// ============================================
// 3. TESTE: LISTAR TODOS (Admin)
// ============================================
async function testarListarTodosComprovativos(filtros = {}) {
    console.log('\n🧪 TESTE 3: Listar Todos os Comprovativos (Admin)');
    console.log('=====================================');

    try {
        const params = new URLSearchParams(filtros).toString();
        const url = `${API_URL}/api/comprovativos${params ? '?' + params : ''}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        console.log('✅ Sucesso!');
        console.log('Total:', response.data.total);
        console.log('Primeiros 3:', JSON.stringify(response.data.comprovativos.slice(0, 3), null, 2));
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

// ============================================
// 4. TESTE: APROVAR COMPROVATIVO (Admin)
// ============================================
async function testarAprovarComprovativo(comprovativoId) {
    console.log('\n🧪 TESTE 4: Aprovar Comprovativo (Admin)');
    console.log('=====================================');
    console.log('ID:', comprovativoId);

    try {
        const response = await axios.put(
            `${API_URL}/api/comprovativos/${comprovativoId}/aprovar`,
            {
                observacoes_admin: 'Comprovativo válido. Aprovado automaticamente em teste!'
            },
            {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            }
        );

        console.log('✅ Sucesso!');
        console.log('Resposta:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

// ============================================
// 5. TESTE: REJEITAR COMPROVATIVO (Admin)
// ============================================
async function testarRejeitarComprovativo(comprovativoId) {
    console.log('\n🧪 TESTE 5: Rejeitar Comprovativo (Admin)');
    console.log('=====================================');
    console.log('ID:', comprovativoId);

    try {
        const response = await axios.put(
            `${API_URL}/api/comprovativos/${comprovativoId}/rejeitar`,
            {
                observacoes_admin: 'Comprovativo ilegível. Por favor, envie uma imagem mais clara.'
            },
            {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            }
        );

        console.log('✅ Sucesso!');
        console.log('Resposta:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

// ============================================
// 6. TESTE: EXCLUIR COMPROVATIVO (Admin)
// ============================================
async function testarExcluirComprovativo(comprovativoId) {
    console.log('\n🧪 TESTE 6: Excluir Comprovativo (Admin)');
    console.log('=====================================');
    console.log('ID:', comprovativoId);

    try {
        const response = await axios.delete(
            `${API_URL}/api/comprovativos/${comprovativoId}`,
            {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            }
        );

        console.log('✅ Sucesso!');
        console.log('Resposta:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

// ============================================
// EXECUTAR TODOS OS TESTES
// ============================================
async function executarTodosTestes() {
    console.log('\n🚀 INICIANDO TESTES DA API DE COMPROVATIVOS');
    console.log('==============================================\n');

    // 1. Enviar comprovativo
    const comprovativoId = await testarEnviarComprovativo();

    if (!comprovativoId) {
        console.error('\n❌ Erro ao enviar comprovativo. Interrompendo testes.');
        return;
    }

    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Listar meus comprovativos
    await testarListarMeusComprovativos();

    // 3. Listar todos (Admin)
    await testarListarTodosComprovativos({ status: 'pendente' });

    // 4. Aprovar comprovativo
    await testarAprovarComprovativo(comprovativoId);

    // OU Rejeitar (descomente se quiser testar)
    // await testarRejeitarComprovativo(comprovativoId);

    // 5. Excluir comprovativo (CUIDADO: vai remover permanentemente)
    // await testarExcluirComprovativo(comprovativoId);

    console.log('\n✅ TESTES CONCLUÍDOS!');
    console.log('==============================================\n');
}

// ============================================
// EXECUTAR
// ============================================
// Descomente a linha abaixo para executar os testes
// executarTodosTestes();

// ============================================
// EXPORTAR FUNÇÕES INDIVIDUAIS
// ============================================
module.exports = {
    testarEnviarComprovativo,
    testarListarMeusComprovativos,
    testarListarTodosComprovativos,
    testarAprovarComprovativo,
    testarRejeitarComprovativo,
    testarExcluirComprovativo,
    executarTodosTestes
};

// ============================================
// INSTRUÇÕES DE USO:
// ============================================
// 1. Instale as dependências (se necessário):
//    npm install axios form-data
//
// 2. Crie um arquivo de imagem de teste:
//    test-comprovativo.jpg
//
// 3. Configure os tokens:
//    - Faça login como usuário e admin
//    - Copie os tokens e cole nas variáveis acima
//
// 4. Execute os testes:
//    node test-comprovativos.js
// ============================================
