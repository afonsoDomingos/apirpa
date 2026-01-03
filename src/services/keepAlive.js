// services/keepAlive.js
const axios = require('axios');

/**
 * Serviço para manter o servidor ativo (evitar cold start)
 * Faz ping a cada 10 minutos para manter o servidor "quente"
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutos

function iniciarKeepAlive() {
    // Não executar em desenvolvimento local
    if (process.env.NODE_ENV === 'development') {
        console.log('⏭️ Keep-alive desativado em desenvolvimento');
        return;
    }

    console.log(`🏓 Keep-alive iniciado (ping a cada ${PING_INTERVAL / 60000} minutos)`);
    console.log(`🎯 URL de ping: ${BACKEND_URL}/health`);

    setInterval(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/health`, {
                timeout: 5000
            });
            console.log('✅ Keep-alive ping:', response.data.status);
        } catch (error) {
            console.error('❌ Keep-alive falhou:', error.message);
        }
    }, PING_INTERVAL);
}

module.exports = { iniciarKeepAlive };
