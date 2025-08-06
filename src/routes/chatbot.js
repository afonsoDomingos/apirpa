const express = require('express');
const router = express.Router();
const axios = require('axios');

if (!process.env.OPENROUTER_API_KEY) {
  console.error('[RPA Assistente] ERRO: A chave OPENROUTER_API_KEY não está definida no ambiente!');
} else {
  console.log('[RPA Assistente] Chave OPENROUTER_API_KEY detectada com sucesso.');
}

router.post('/', async (req, res) => {
  const { message } = req.body;

  console.log(`[RPA Assistente] Mensagem recebida do usuário: "${message}"`);

  try {
    console.log('[RPA Assistente] Enviando requisição para OpenRouter...');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-oss-20b',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `
Você é o RPA Assistente, um assistente especializado em ajudar usuários a recuperar documentos na plataforma.

⚠️ Regras de conduta:
- Responda sempre em **português**, de forma **educada, curta e objetiva**.
- Você só pode responder perguntas sobre:
  - Como reportar documentos perdidos,
  - Como recuperar documentos através da plataforma,
  - Boas práticas para garantir a segurança dos documentos.

❌ Nunca responda temas fora desse escopo.

📌 Se o usuário fizer perguntas fora desse contexto, responda com:

"Desculpe, só posso te ajudar com informações sobre documentos perdidos, como recuperá-los através da plataforma, ou dicas para manter seus documentos seguros. Por favor, pergunte sobre isso."

👤 Se o usuário perguntar quem é o criador do assistente, responda:

"O RPA Assistente foi criado por Afonso Domingos, moçambicano, residente em Maputo, autodidata em Informática e Inteligência Artificial."

Nunca fale sobre o criador se não for perguntado diretamente.
            `.trim(),
          },
          {
            role: 'user',
            content: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3000',
          'X-Title': 'RPA Assistente',
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    console.log(`[RPA Assistente] Resposta recebida: "${reply}"`);

    res.json({ reply });

  } catch (error) {
    console.error('[RPA Assistente] Erro ao processar mensagem:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao processar mensagem com a OpenRouter',
      details: error.response?.data || null,
    });
  }
});

module.exports = router;
