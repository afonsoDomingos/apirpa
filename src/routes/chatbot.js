const express = require('express');
const router = express.Router();
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const NodeCache = require('node-cache');

// Cache para respostas comuns (5 minutos de TTL)
const responseCache = new NodeCache({ stdTTL: 300 });

// Rate limiting - 10 mensagens por minuto por IP
const chatbotRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: {
    error: 'Muitas mensagens enviadas. Tente novamente em um minuto.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pula rate limit para rota de teste em desenvolvimento
    return process.env.NODE_ENV === 'development' && req.path === '/test';
  }
});

// Middleware de logging
router.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${timestamp}] RPA Assistente - ${req.method} ${req.path} - IP: ${ip}`);
  next();
});

// Respostas de fallback quando a API externa falha
const fallbackResponses = {
  'ola': 'Olá! Sou o RPA Assistente. Como posso ajudá-lo com documentos perdidos hoje?',
  'oi': 'Oi! Estou aqui para ajudar com recuperação de documentos. O que precisa?',
  'como recuperar documento': 'Para recuperar documentos, acesse nossa plataforma em recuperaaqui.co.mz, faça login e use a seção "Procurar Documentos".',
  'como reportar documento': 'Para reportar um documento encontrado, acesse a plataforma, faça login e use a seção "Reportar Documento Encontrado".',
  'contato': 'Você pode nos contatar pelo telefone/WhatsApp: 879 642 412 ou visite nosso site: recuperaaqui.co.mz',
  'criar conta': 'Para criar uma conta, acesse https://recuperaaqui.vercel.app/ e preencha o formulário de cadastro com nome, e-mail e senha.',
  'como funciona': 'A plataforma RPA/RecuperaAqui conecta pessoas que perderam documentos com aquelas que os encontraram. Você pode procurar ou reportar documentos após criar uma conta.',
  'default': 'Desculpe, estou temporariamente indisponível. Tente novamente em alguns minutos ou contate nosso suporte em 879 642 412.'
};

// Função para obter resposta de fallback
const getFallbackResponse = (message) => {
  const normalizedMessage = message.toLowerCase().trim();
  
  // Verifica correspondências exatas primeiro
  if (fallbackResponses[normalizedMessage]) {
    return fallbackResponses[normalizedMessage];
  }
  
  // Verifica correspondências parciais
  for (const [key, response] of Object.entries(fallbackResponses)) {
    if (normalizedMessage.includes(key)) {
      return response;
    }
  }
  
  return fallbackResponses.default;
};

// Log inicial para verificar se a chave foi detectada
if (!process.env.OPENROUTER_API_KEY) {
  console.error('[RPA Assistente] ERRO: A chave OPENROUTER_API_KEY não está definida no ambiente!');
} else {
  console.log('[RPA Assistente] Chave OPENROUTER_API_KEY detectada com sucesso.');
}

// ✅ Rota principal do chatbot
router.post('/', chatbotRateLimit, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message } = req.body;

    // Validação de entrada
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Mensagem inválida ou vazia. Por favor, envie uma mensagem válida.' 
      });
    }

    // Limite de caracteres
    if (message.length > 2000) {
      return res.status(400).json({ 
        error: 'Mensagem muito longa. O limite é de 2000 caracteres.' 
      });
    }

    // Sanitização básica
    const sanitizedMessage = validator.escape(message.trim());
    
    // Log seguro da mensagem (sem expor conteúdo completo em produção)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[RPA Assistente] Mensagem recebida: "${sanitizedMessage}"`);
    } else {
      console.log(`[RPA Assistente] Mensagem recebida (${sanitizedMessage.length} chars)`);
    }

    // Verificar cache primeiro
    const cacheKey = `chat_${sanitizedMessage.toLowerCase()}`;
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse) {
      console.log('[RPA Assistente] Resposta obtida do cache');
      return res.json({ 
        reply: cachedResponse,
        cached: true,
        responseTime: Date.now() - startTime
      });
    }

    // Verificar se a API key está disponível
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('[RPA Assistente] API Key não disponível, usando fallback');
      const fallbackReply = getFallbackResponse(sanitizedMessage);
      return res.json({ 
        reply: fallbackReply,
        fallback: true,
        responseTime: Date.now() - startTime
      });
    }

    console.log('[RPA Assistente] Enviando requisição para OpenRouter...');
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-oss-20b',
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `

# RPA Assistente - Instruções Melhoradas

## 🎯 IDENTIDADE
Você é o RPA Assistente, especializado em ajudar usuários da plataforma RecuperaAqui (RPA) em Moçambique.

## ⚡ DIRETRIZES DE COMUNICAÇÃO
- **Respostas curtas e diretas** (máximo 3-4 linhas)
- **Sempre em português** e linguagem acessível
- **Tom educado e profissional**
- **Nunca usar asteriscos (*)** na formatação
- **Focar na solução** do problema do usuário

## 🎯 TEMAS PERMITIDOS (ESCOPO RESTRITO)
✅ **Apenas temas relacionados à plataforma RPA:**
- Recuperação de documentos perdidos
- Reporte de documentos encontrados
- Armazenamento seguro de documentos
- Geração de CV na plataforma
- Solicitação de documentos
- Segurança de documentos
- Suporte técnico
- Sistema de comissões (25% para quem encontra)
- Assinaturas e pagamentos

## 📱 INFORMAÇÕES DA PLATAFORMA

### Como Usar:
1. **Acesse:** https://recuperaaqui.vercel.app/
2. **Crie sua conta** gratuitamente
3. **Escolha a seção:**
   - "Procurar Documentos": busque por tipo/número/província
   - "Reportar Documento": reporte documentos encontrados

### Planos de Assinatura:
- **Mensal:** 150 MZN
- **Anual:** 650 MZN (economia significativa)

### Sistema de Comissões:
- **25% de comissão** para quem encontra e reporta documentos
- Pagamento após confirmação da recuperação

## 📞 CONTATOS OFICIAIS
- **Site:** recuperaaqui.co.mz
- **WhatsApp:** 879 642 412
- **Facebook:** https://web.facebook.com/people/Rpa/61570930139844/
- **Área de atuação:** Moçambique (todas as províncias)

## ❌ PARA TEMAS FORA DO ESCOPO
**Resposta padrão:** "Desculpe, só posso ajudar com informações sobre a plataforma RecuperaAqui."

## 👤 SOBRE O CRIADOR (apenas se perguntado)
"O RPA Assistente foi criado por Afonso Domingos, moçambicano de Maputo, especialista em IA.
- LinkedIn: https://www.linkedin.com/in/afonso-domingos-6b59361a5/
- Contato: 847 877 405"

## 🚀 FLUXO DE ATENDIMENTO OTIMIZADO

### Para Recuperação de Documentos (USAR FLUXO AUTOMATIZADO):
**IMPORTANTE:** Quando alguém disser que perdeu documento, ativar o fluxo automatizado do frontend:

1. **Detectar palavras-chave:** "perdi", "perdeu", "documento perdido", "como recuperar", "BI perdido", "passaporte perdido", "procurar documento"

2. **Ativar fluxo automático:** O sistema vai coletar automaticamente , e de forma sequenciada, uma pergunta de cada vez:
   - Nome completo no documento
   - Tipo de documento (BI, Passaporte, etc.)
   - Número do documento (se souber)
   - Província onde perdeu

3. **Busca automática:** O sistema consulta automaticamente a base de dados

4. **Resultados automáticos:**
   - Se encontrar: Mostra documentos e direciona para "Procurar" para solicitar
   - Se não encontrar: Sugere cadastro na aba "Reportar"

**Resposta padrão para recuperação:**
"Vou te ajudar a procurar seu documento automaticamente! Preciso de algumas informações para fazer a busca na nossa base de dados."

### Para Reporte de Documentos:
1. Orientar acesso à seção "Reportar Documento"
2. Explicar preenchimento de dados
3. Mencionar sistema de comissão (25%)
4. Orientar sobre verificação e pagamento

### Para Problemas Técnicos:
1. Sugerir contato direto via WhatsApp: 879 642 412
2. Orientar para Facebook se necessário
3. Nunca tentar resolver problemas técnicos complexos

## 📋 RESPOSTAS PRONTAS (TEMPLATES)

### Template para Busca Automática:
"Entendi que perdeu seu documento! Vou ativar nossa busca automática. O sistema vai coletar seus dados e procurar na base de dados automaticamente."

### Palavras-Chave que Ativam Busca Automática:
- "perdi meu documento", "perdeu", "documento perdido"
- "BI perdido", "passaporte perdido", "carta perdida"
- "como recuperar documento", "procurar documento"
- "encontrar documento", "buscar documento"

### Fora do Escopo:
"Desculpe, só posso ajudar com informações sobre a plataforma RecuperaAqui."

### Encaminhamento para Suporte:
"Para essa questão específica, contacte nosso suporte via WhatsApp: 879 642 412"

### Finalização:
"Mais alguma dúvida sobre a plataforma? Estou aqui para ajudar!"

## ⚠️ REGRAS CRÍTICAS
- **NUNCA** fornecer informações sobre outros temas
- **NUNCA** usar formatação com asteriscos
- **SEMPRE** manter respostas concisas
- **SEMPRE** direcionar para canais oficiais quando necessário
- **SEMPRE** focar na experiência do usuário moçambicano

`.trim(),
          },
          {
            role: 'user',
            content: sanitizedMessage,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3000',
          'X-Title': 'RPA Assistente',
        },
        timeout: 30000, // 30 segundos de timeout
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    
    if (!reply) {
      throw new Error('Resposta inválida da API');
    }

    console.log(`[RPA Assistente] Resposta recebida com sucesso (${reply.length} chars)`);

    // Salvar no cache apenas respostas bem-sucedidas
    responseCache.set(cacheKey, reply);

    res.json({ 
      reply,
      responseTime: Date.now() - startTime,
      tokensUsed: response.data.usage?.total_tokens || 'N/A'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('[RPA Assistente] Erro ao processar mensagem:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseTime
    });

    // Tratamento específico de diferentes tipos de erro
    if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Muitas requisições para o serviço de IA. Tente novamente em alguns segundos.',
        retryAfter: 30,
        responseTime
      });
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('[RPA Assistente] Erro de autenticação com OpenRouter');
      const fallbackReply = getFallbackResponse(req.body.message || '');
      return res.json({
        reply: fallbackReply,
        fallback: true,
        reason: 'authentication_error',
        responseTime
      });
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const fallbackReply = getFallbackResponse(req.body.message || '');
      return res.json({
        reply: fallbackReply,
        fallback: true,
        reason: 'timeout',
        responseTime
      });
    }

    // Fallback para qualquer outro erro
    const fallbackReply = getFallbackResponse(req.body.message || '');
    res.json({
      reply: fallbackReply,
      fallback: true,
      reason: 'service_unavailable',
      responseTime
    });
  }
});

// ✅ Rota para teste de chave e conectividade  
router.get('/test', async (req, res) => {
  console.log('[RPA Assistente] Testando conexão com OpenRouter...');
  
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ 
        status: 'erro', 
        message: 'Chave OPENROUTER_API_KEY não configurada',
        timestamp: new Date().toISOString()
      });
    }

    const startTime = Date.now();

    // Faz uma chamada simples para validar a chave
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-oss-20b',
        messages: [{ 
          role: 'user', 
          content: 'Responda apenas "OK" para testar a conexão.' 
        }],
        max_tokens: 10,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3000',
          'X-Title': 'RPA Assistente Test',
        },
        timeout: 15000,
      }
    );

    const responseTime = Date.now() - startTime;

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      res.json({ 
        status: 'ok', 
        message: 'Conexão com OpenRouter bem-sucedida!',
        responseTime: `${responseTime}ms`,
        model: 'openai/gpt-oss-20b',
        timestamp: new Date().toISOString(),
        testResponse: response.data.choices[0].message.content
      });
    } else {
      res.status(500).json({ 
        status: 'erro', 
        message: 'Resposta inesperada da API OpenRouter',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      timestamp: new Date().toISOString()
    };

    console.error('[RPA Assistente] Erro no teste de conexão:', errorDetails);
    
    res.status(500).json({
      status: 'erro',
      message: 'Falha ao conectar com OpenRouter',
      details: errorDetails
    });
  }
});

// ✅ Rota para estatísticas do cache
router.get('/stats', (req, res) => {
  const stats = responseCache.getStats();
  res.json({
    cache: {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
});

// ✅ Rota para limpar cache (útil para desenvolvimento)
router.post('/clear-cache', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Operação não permitida em produção'
    });
  }
  
  responseCache.flushAll();
  console.log('[RPA Assistente] Cache limpo manualmente');
  
  res.json({
    message: 'Cache limpo com sucesso',
    timestamp: new Date().toISOString()
  });
});

// ✅ Rota de health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RPA Assistente',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

module.exports = router;