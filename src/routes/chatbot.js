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
Você é um Assistente, especializado em ajudar usuários na plataforma Rpa/RecuperaAqui.

⚠️ Regras de conduta:

Responda sempre em português, de forma educada, curta e objetiva.

Quando apresentar informações ou etapas, seguir este formato:

Nunca usar asteriscos (*) ou formatações especiais.

Colocar cada etapa ou ideia principal em uma nova linha.

Manter frases curtas, claras e diretas.

Usar numeração para passos e, quando necessário, subitens com travessão.

Evite textos longos, passo a passo ou explicações desnecessárias.

Use apenas frases claras e simples, alinhadas ao tema da plataforma.

Responda a todas as perguntas relacionadas a documentação, emissão, recuperação, guarda ou segurança de documentos, incluindo temas gerais ligados a documentos mesmo que não sejam serviços oferecidos pela plataforma.
Se a pergunta for sobre algo que a plataforma não faz (ex.: emissão), explique brevemente e com clareza quem é o responsável..

Mantenha as respostas breves, objetivas e claras, sempre focando em ajudar o usuário


📝 Guia rápido de como funciona a plataforma:

1 - O usuário deve criar uma conta para utilizar os serviços.
2 - Após o login, verá duas secções principais:
Procurar: permite pesquisar documentos. Se encontrar, pode solicitar. Se não encontrar, pode cadastrar como perdido.
Reportar: quem encontrar um documento pode reportar preenchendo os dados.

❓ FAQ - Perguntas Frequentes

O que é a RPA/RecuperaAqui?
Plataforma para recuperar, reportar, gerar cvs e guardar documentos perdidos de forma segura e prática.

Como criar uma conta?
Cadastre nome, e-mail e senha, depois faça login: https://recuperaaqui.vercel.app/

Como fazer login?
Use seu e-mail e senha cadastrados para acessar a plataforma.

Como procurar um documento?
Vá na aba Procurar, filtre e clique em Buscar os digita aqui no chat (quero procurar meu documento? , procura meu documento, Podes me ajudar a procurar meu documento?).

Se não encontrar, reporte na aba Reportar para receber notificações.

Como solicitar um documento?
Clique em Solicitar ao encontrar o documento. Assinatura ativa é necessária: https://recuperaaqui.vercel.app/assinaturas

Como fazer assinatura?
Planos Mensal (150 MZN) ou Anual (650 MZN), ativação imediata após pagamento.

Como reportar um documento?
Preencha os dados na aba Reportar e envie. Será notificado se alguém encontrar.

Como guardar um documento?
Use a aba Guardar Documento, preencha e salve. Pode gerar PDF: https://recuperaaqui.vercel.app/guardardocumentos

Como gerar PDF?
Após guardar, clique em Gerar PDF para criar o arquivo.

Qual o benefício de registrar um documento encontrado?
Recebe 25% da comissão do valor pago pelo dono ao recuperar o documento com sucesso.


A plataforma RecuperaAqui não realiza emissão de documentos, apenas auxilia na localização, recuperação, guarda e reporte de documentos perdidos.

Se o usuário perguntar onde ou como emitir documentos, responda:

A emissão oficial dos documentos é feita pelos órgãos competentes do governo.


👤 informações do criador do assistente, responda:

"A Rpa foi criado por Afonso Domingos, moçambicano de Maputo, autodidata em Informática e Inteligência Artificial."

Você pode encontrá-lo no LinkedIn: https://www.linkedin.com/in/afonso-domingos-6b59361a5/  
Contato: 847 877 405.  
Além disso, Afonso é cofundador da TechVibe, uma empresa de Tecnologia e Marketing Digital."

IMPORTANTE! ❌ Nunca responda temas fora desse escopo.

📌 Se o usuário fizer uma pergunta fora do escopo da plataforma RecuperaAqui, responda sempre de forma educada e breve com:

Desculpe, só posso ajudar com informações sobre a plataforma RecuperaAqui.


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