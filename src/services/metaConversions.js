// metaConversions.js
const crypto = require('crypto');
const axios = require('axios');

// ===============================
// CONFIGURAÇÃO DO PIXEL
// ===============================
const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// Validação de credenciais
if (!PIXEL_ID || !ACCESS_TOKEN) {
  console.error('❌ ERRO CRÍTICO: META_PIXEL_ID ou META_ACCESS_TOKEN não configurados!');
  console.error('Configure essas variáveis no arquivo .env ou no painel do Render.');
} else {
  console.log("🔵 Meta CAPI carregado (metaConversions.js)");
  console.log(`✓ Pixel ID: ${PIXEL_ID}`);
  console.log(`✓ Access Token: ${ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 20) + '...' : 'AUSENTE'}`);
}

// ===============================
// FUNÇÃO DE HASH — REQUERIDO
// ===============================
const hash = (data) => {
  if (!data) return null;
  const cleaned = data.toString().trim().toLowerCase();
  return crypto.createHash('sha256').update(cleaned).digest('hex');
};

// ===============================
// FUNÇÃO PRINCIPAL DE ENVIO CAPI
// ===============================
const sendConversionEvent = async (eventName, eventData = {}, userData = {}, eventId) => {

  if (!eventId) {
    console.warn("⚠️ CAPI BLOQ → eventId ausente (necessário para deduplicação)");
    return;
  }

  console.log(`📤 Preparando evento CAPI: "${eventName}" (ID: ${eventId})`);

  // ===============================
  // MONTA O EVENTO FACEBOOK CAPI
  // ===============================
  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',

    user_data: {
      em: userData.email ? [hash(userData.email)] : [],
      ph: userData.phone ? [hash(userData.phone)] : [],
      client_ip_address: eventData.ip || null,
      client_user_agent: eventData.userAgent || null,
      fbp: userData.fbp || null,
      fbc: userData.fbc || null
    },

    custom_data: {
      value: eventData.value || 0,
      currency: 'MZN',
      content_name: eventData.content_name || null,
      content_ids: eventData.content_ids || null,
      predicted_ltv: eventData.predicted_ltv || null
    },

    event_source_url: eventData.url || 'https://recuperaaqui.vercel.app',

    // Melhoram match rate 2025
    data_processing_options: [],
    opt_out: false
  };

  // ===============================
  // ENVIO PARA O FACEBOOK
  // ===============================
  try {
    if (!PIXEL_ID || !ACCESS_TOKEN) {
      console.error('❌ CAPI BLOQUEADO: Credenciais não configuradas');
      return { error: 'Meta credentials not configured' };
    }

    console.log("⏳ Enviando evento para Meta...");

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { data: [event] },
      { timeout: 8000 }
    );

    // Validar resposta do Facebook
    if (response.data.events_received === 1) {
      console.log(`✅ CAPI ENVIADO: ${eventName} (${eventData.value || 0} MZN)`);
      console.log(`   Match Score: ${response.data.fbtrace_id || 'N/A'}`);
      return response.data;
    } else {
      console.warn(`⚠️ CAPI PARCIAL: Evento enviado mas não confirmado`);
      return response.data;
    }

  } catch (error) {
    console.error("❌ ERRO AO ENVIAR CAPI:");

    if (error.response) {
      // Erro da API do Facebook
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Mensagem:`, error.response.data);

      // Erros comuns
      if (error.response.status === 400) {
        console.error('   → Verifique se o Pixel ID e Access Token estão corretos');
      } else if (error.response.status === 401) {
        console.error('   → Access Token expirado ou inválido');
      }
    } else {
      console.error(error.message);
    }

    return { error: error.message };
  }
};

module.exports = { sendConversionEvent };
