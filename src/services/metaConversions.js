// metaConversions.js
const crypto = require('crypto');
const axios = require('axios');

// ===============================
// CONFIGURAÇÃO DO PIXEL
// ===============================
const PIXEL_ID = '1265895278678340';

// ⚠️ IMPORTANTE:
// Coloque teu token real aqui.
// Nunca deixar em apps públicos.
const ACCESS_TOKEN = 'EAAV724cEmmgBP6uVCd8mzjSIE6MaZA9y9ZCIMZCpU4KOhikUtCBZAv1ZCq5GG7Dl1B4jSZBd1B1JhDRd9iapnzALkV5t8Trb8LZAwIvKCrJ8cp4wV3dzqOEqYaRUMZAVFiBzJcbk1VKusiZAMLqzocubjWoZAex310c7rWwqq8HHWzT70IuyaBQnlxLw4f66UtWkPx3wZDZD';

console.log("🔵 Meta CAPI carregado (metaConversions.js)");

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
    console.log("⏳ Enviando evento para Meta...");

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { data: [event] },
      { timeout: 8000 }
    );

    console.log(`✅ CAPI ENVIADO: ${eventName} (${eventData.value || 0} MZN)`);
    return response.data;

  } catch (error) {
    console.error("❌ ERRO AO ENVIAR CAPI:");
    console.error(error.response?.data || error.message);
  }
};

module.exports = { sendConversionEvent };
