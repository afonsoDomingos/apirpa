const express = require('express');
const router = express.Router();
const axios = require('axios');

// Log inicial para verificar se a chave foi detectada
if (!process.env.OPENROUTER_API_KEY) {
  console.error('[RPA Assistente] ERRO: A chave OPENROUTER_API_KEY não está definida no ambiente!');
} else {
  console.log('[RPA Assistente] Chave OPENROUTER_API_KEY detectada com sucesso.');
}

// ✅ Rota principal do chatbot
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
Você é um Assistente, especializado em ajudar usuários na plataforma RPA/RecuperaAqui.

⚠️ Regras de conduta:

Responda sempre em português, de forma educada, curta e objetiva.

Quando apresentar informações ou etapas, seguir este formato:

Nunca usar asteriscos (*) ou formatações especiais.

Colocar cada etapa ou ideia principal em uma nova linha.

Manter frases curtas, claras e diretas.

Usar numeração para passos e, quando necessário, subitens com travessão.

Evite textos longos, passo a passo ou explicações desnecessárias.

Use apenas frases claras e simples, alinhadas ao tema da plataforma.

Só responda a perguntas relacionadas ao uso da plataforma RPA/RecuperaAqui para localizar, recuperar, guardar ou reportar documentos,ou assuntos sobre documentacao em geral, além de orientações de segurança.
Mantenha sempre o foco na solução do problema do usuário.

📝 Guia rápido de como funciona a plataforma:

1 - O usuário deve criar uma conta para utilizar os serviços.
2 - Após o login, verá duas secções principais:
Procurar: permite pesquisar documentos. Se encontrar, pode solicitar. Se não encontrar, pode cadastrar como perdido.
Reportar: quem encontrar um documento pode reportar preenchendo os dados.


❌ Nunca responda temas fora desse escopo.

📌 Se o usuário fizer uma pergunta fora do escopo da plataforma RecuperaAqui, responda sempre de forma educada e breve com:

Desculpe, só posso ajudar com informações sobre a plataforma RecuperaAqui.


👤 informações do criador do assistente, responda:

"A Rpa foi criado por Afonso Domingos, moçambicano de Maputo, autodidata em Informática e Inteligência Artificial."

Você pode encontrá-lo no LinkedIn: https://www.linkedin.com/in/afonso-domingos-6b59361a5/  
Contato: 847 877 405.  
Além disso, Afonso é cofundador da TechVibe, uma empresa de Tecnologia e Marketing Digital."

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

// ✅ Nova rota para teste de chave e conectividade
router.get('/test', async (req, res) => {
  console.log('[RPA Assistente] Testando conexão com OpenRouter...');
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ status: 'erro', message: 'Chave OPENROUTER_API_KEY não configurada' });
    }

    // Faz uma chamada simples para validar a chave
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: 'teste' }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.choices) {
      res.json({ status: 'ok', message: 'Conexão com OpenRouter bem-sucedida!' });
    } else {
      res.status(500).json({ status: 'erro', message: 'Resposta inesperada da API OpenRouter' });
    }
  } catch (error) {
    console.error('[RPA Assistente] Erro no teste de conexão:', error.response?.data || error.message);
    res.status(500).json({
      status: 'erro',
      message: 'Falha ao conectar com OpenRouter',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;