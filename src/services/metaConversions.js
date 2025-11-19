// metaConversions.js
const crypto = require('crypto');
const axios = require('axios');

const PIXEL_ID = '1265895278678340';
const ACCESS_TOKEN = 'EAAV724cEmmgBP6uVCd8mzjSIE6MaZA9y9ZCIMZCpU4KOhikUtCBZAv1ZCq5GG7Dl1B4jSZBd1B1JhDRd9iapnzALkV5t8Trb8LZAwIvKCrJ8cp4wV3dzqOEqYaRUMZAVFiBzJcbk1VKusiZAMLqzocubjWoZAex310c7rWwqq8HHWzT70IuyaBQnlxLw4f66UtWkPx3wZDZD'; // ← só isto que falta preencher!

const hash = (data) => {
  if (!data) return null;
  const cleaned = data.toString().trim().toLowerCase();
  return crypto.createHash('sha256').update(cleaned).digest('hex');
};

const sendConversionEvent = async (eventName, eventData = {}, userData = {}, eventId) => {
  // Validação básica
  if (!eventId) {
    console.warn('CAPI: eventId ausente — evento não enviado (evita duplicação)');
    return;
  }

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,                    // ← OBRIGATÓRIO para deduplicação com browser
    user_data: {
      em: userData.email ? [hash(userData.email)] : [],
      ph: userData.phone ? [hash(userData.phone)] : [],
      client_ip_address: eventData.ip,
      client_user_agent: eventData.userAgent,
      fbp: userData.fbp || null,
      fbc: userData.fbc || null,
    },
    custom_data: {
      value: eventData.value || 0,
      currency: 'MZN',
      predicted_ltv: eventData.predicted_ltv || null,
      content_ids: eventData.content_ids || null,
      content_name: eventData.content_name || null,
    },
    event_source_url: eventData.url || 'https://recuperaaquivercel.app',
    action_source: 'website',
    // Estes dois campos são os que mais aumentam o match rate em 2025:
    data_processing_options: [],
    opt_out: false
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { data: [event] },  // ← formato correto (data: [])
      { timeout: 8000 }
    );

    console.log('CAPI →', eventName, eventData.value ? `${eventData.value} MZN` : '', 'OK');
    return response.data;
  } catch (error) {
    console.error('Erro CAPI:', error.response?.data || error.message);
  }
};

module.exports = { sendConversionEvent };