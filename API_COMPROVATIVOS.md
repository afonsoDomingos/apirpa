# 📄 API de Comprovativos de Pagamento

## 📋 Visão Geral

Esta API permite que os usuários enviem comprovativos de pagamento (imagens ou PDFs) e que administradores gerenciem (aprovem/rejeitem) esses comprovativos.

## 🔑 Autenticação

Todas as rotas requerem autenticação via token JWT no header:
```
Authorization: Bearer SEU_TOKEN_JWT
```

---

## 📤 1. ENVIAR COMPROVATIVO (Usuário)

**Endpoint:** `POST /api/comprovativos/enviar`

**Autenticação:** Requerida (Usuário autenticado)

**Content-Type:** `multipart/form-data`

### Parâmetros (FormData):

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `comprovativo` | File | ✅ Sim | Arquivo de imagem (JPG, PNG, WEBP) ou PDF (máx 10MB) |
| `metodo_pagamento` | String | ✅ Sim | Valores: `mpesa`, `emola`, `transferencia_bancaria`, `ponto24`, `outro` |
| `tipo` | String | ✅ Sim | Valores: `assinatura`, `anuncio`, `outro` |
| `valor_pago` | Number | ✅ Sim | Valor pago em MZN (maior que 0) |
| `referencia` | String | ✅ Sim | Referência do pagamento (ex: código de transação) |
| `observacoes` | String | ❌ Não | Observações adicionais do usuário |

### Exemplo de Requisição (JavaScript/Axios):

```javascript
const formData = new FormData();
formData.append('comprovativo', arquivoSelecionado); // File object
formData.append('metodo_pagamento', 'mpesa');
formData.append('tipo', 'assinatura');
formData.append('valor_pago', '150');
formData.append('referencia', 'MPE123456789');
formData.append('observacoes', 'Pagamento realizado hoje às 14h');

const response = await axios.post('/api/comprovativos/enviar', formData, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'multipart/form-data'
  }
});
```

### Resposta de Sucesso (201):

```json
{
  "sucesso": true,
  "mensagem": "Comprovativo recebido com sucesso! Aguarde a análise do administrador.",
  "comprovativo": {
    "id": "6789abc123def456",
    "metodo_pagamento": "mpesa",
    "valor_pago": 150,
    "referencia": "MPE123456789",
    "tipo": "assinatura",
    "status": "pendente",
    "arquivo_url": "https://res.cloudinary.com/.../comprovativo.jpg",
    "createdAt": "2026-01-03T12:30:00.000Z"
  }
}
```

### Respostas de Erro:

**400 - Dados Incompletos:**
```json
{
  "sucesso": false,
  "mensagem": "Dados incompletos. Preencha todos os campos obrigatórios."
}
```

**400 - Arquivo Obrigatório:**
```json
{
  "sucesso": false,
  "mensagem": "Comprovativo é obrigatório. Envie uma imagem ou PDF."
}
```

**400 - Formato Inválido:**
```json
{
  "sucesso": false,
  "mensagem": "Formato de arquivo inválido. Apenas imagens (JPG, PNG, WEBP) ou PDF são permitidos."
}
```

---

## 📋 2. LISTAR MEUS COMPROVATIVOS (Usuário)

**Endpoint:** `GET /api/comprovativos/meus`

**Autenticação:** Requerida (Usuário autenticado)

### Resposta de Sucesso (200):

```json
{
  "sucesso": true,
  "total": 3,
  "comprovativos": [
    {
      "id": "6789abc123def456",
      "metodo_pagamento": "mpesa",
      "tipo": "assinatura",
      "valor_pago": 150,
      "referencia": "MPE123456789",
      "observacoes": "Pagamento realizado hoje",
      "status": "aprovado",
      "arquivo_url": "https://res.cloudinary.com/.../comprovativo.jpg",
      "observacoes_admin": "Comprovativo válido. Aprovado!",
      "data_analise": "2026-01-03T14:00:00.000Z",
      "createdAt": "2026-01-03T12:30:00.000Z",
      "updatedAt": "2026-01-03T14:00:00.000Z"
    }
  ]
}
```

---

## 🔐 3. LISTAR TODOS OS COMPROVATIVOS (Admin)

**Endpoint:** `GET /api/comprovativos`

**Autenticação:** Requerida (Admin ou SuperAdmin)

### Query Parameters (Filtros Opcionais):

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | String | Filtrar por status: `pendente`, `em_analise`, `aprovado`, `rejeitado` |
| `metodo_pagamento` | String | Filtrar por método: `mpesa`, `emola`, etc. |
| `tipo` | String | Filtrar por tipo: `assinatura`, `anuncio`, `outro` |
| `busca` | String | Buscar por referência, nome ou email do usuário |

### Exemplo de Requisição:

```
GET /api/comprovativos?status=pendente&tipo=assinatura
```

### Resposta de Sucesso (200):

```json
{
  "sucesso": true,
  "total": 5,
  "comprovativos": [
    {
      "id": "6789abc123def456",
      "usuario": {
        "id": "user123",
        "nome": "João Silva",
        "email": "joao@email.com"
      },
      "metodo_pagamento": "mpesa",
      "tipo": "assinatura",
      "valor_pago": 150,
      "referencia": "MPE123456789",
      "observacoes": "Pagamento realizado hoje",
      "status": "pendente",
      "arquivo_url": "https://res.cloudinary.com/.../comprovativo.jpg",
      "observacoes_admin": null,
      "data_analise": null,
      "admin_responsavel": null,
      "createdAt": "2026-01-03T12:30:00.000Z",
      "updatedAt": "2026-01-03T12:30:00.000Z"
    }
  ]
}
```

---

## ✅ 4. APROVAR COMPROVATIVO (Admin)

**Endpoint:** `PUT /api/comprovativos/:id/aprovar`

**Autenticação:** Requerida (Admin ou SuperAdmin)

### Parâmetros:

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `observacoes_admin` | String | ❌ Não | Observações do admin sobre a aprovação |

### Exemplo de Requisição:

```javascript
await axios.put('/api/comprovativos/6789abc123def456/aprovar', {
  observacoes_admin: 'Comprovativo válido. Aprovado!'
}, {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
```

### Resposta de Sucesso (200):

```json
{
  "sucesso": true,
  "mensagem": "Comprovativo aprovado com sucesso!",
  "comprovativo": {
    "id": "6789abc123def456",
    "status": "aprovado",
    "data_analise": "2026-01-03T14:00:00.000Z",
    "observacoes_admin": "Comprovativo válido. Aprovado!"
  }
}
```

### Respostas de Erro:

**400 - Já Aprovado:**
```json
{
  "sucesso": false,
  "mensagem": "Este comprovativo já foi aprovado."
}
```

**404 - Não Encontrado:**
```json
{
  "sucesso": false,
  "mensagem": "Comprovativo não encontrado."
}
```

---

## ❌ 5. REJEITAR COMPROVATIVO (Admin)

**Endpoint:** `PUT /api/comprovativos/:id/rejeitar`

**Autenticação:** Requerida (Admin ou SuperAdmin)

### Parâmetros:

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `observacoes_admin` | String | ✅ Sim | Motivo da rejeição (obrigatório) |

### Exemplo de Requisição:

```javascript
await axios.put('/api/comprovativos/6789abc123def456/rejeitar', {
  observacoes_admin: 'Comprovativo ilegível. Por favor, envie uma imagem mais clara.'
}, {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
```

### Resposta de Sucesso (200):

```json
{
  "sucesso": true,
  "mensagem": "Comprovativo rejeitado.",
  "comprovativo": {
    "id": "6789abc123def456",
    "status": "rejeitado",
    "data_analise": "2026-01-03T14:00:00.000Z",
    "observacoes_admin": "Comprovativo ilegível. Por favor, envie uma imagem mais clara."
  }
}
```

### Respostas de Erro:

**400 - Observações Obrigatórias:**
```json
{
  "sucesso": false,
  "mensagem": "Observações são obrigatórias ao rejeitar um comprovativo."
}
```

---

## 🗑️ 6. EXCLUIR COMPROVATIVO (Admin)

**Endpoint:** `DELETE /api/comprovativos/:id`

**Autenticação:** Requerida (Admin ou SuperAdmin)

### Resposta de Sucesso (200):

```json
{
  "sucesso": true,
  "mensagem": "Comprovativo removido com sucesso."
}
```

---

## 📊 Status dos Comprovativos

| Status | Descrição |
|--------|-----------|
| `pendente` | Comprovativo enviado, aguardando análise |
| `em_analise` | Comprovativo em processo de análise (futuro) |
| `aprovado` | Comprovativo aprovado pelo administrador |
| `rejeitado` | Comprovativo rejeitado pelo administrador |

---

## 🔔 Notificações

Quando um comprovativo é enviado, o sistema automaticamente:

1. ✅ Salva o arquivo no **Cloudinary** (pasta `rpa_comprovativos`)
2. ✅ Cria o registro no banco de dados
3. ✅ Envia uma **notificação push** para os administradores
4. ✅ Retorna resposta imediata para o usuário

---

## 🛡️ Validações de Segurança

- ✅ Apenas usuários autenticados podem enviar comprovativos
- ✅ Apenas admins podem aprovar/rejeitar/excluir
- ✅ Tamanho máximo do arquivo: **10MB**
- ✅ Formatos aceitos: **JPG, PNG, WEBP, PDF**
- ✅ Validação de tipos no backend (Multer + Cloudinary)

---

## 🚀 Integração no Frontend

### Exemplo Completo - Vue.js:

```vue
<template>
  <div class="enviar-comprovativo">
    <form @submit.prevent="enviarComprovativo">
      <input 
        type="file" 
        @change="selecionarArquivo" 
        accept="image/*,.pdf"
        required 
      />
      
      <select v-model="form.metodo_pagamento" required>
        <option value="mpesa">M-Pesa</option>
        <option value="emola">e-Mola</option>
        <option value="transferencia_bancaria">Transferência Bancária</option>
      </select>
      
      <select v-model="form.tipo" required>
        <option value="assinatura">Assinatura</option>
        <option value="anuncio">Anúncio</option>
      </select>
      
      <input 
        v-model.number="form.valor_pago" 
        type="number" 
        placeholder="Valor (MZN)"
        required 
      />
      
      <input 
        v-model="form.referencia" 
        placeholder="Referência"
        required 
      />
      
      <textarea 
        v-model="form.observacoes" 
        placeholder="Observações (opcional)"
      ></textarea>
      
      <button type="submit" :disabled="enviando">
        {{ enviando ? 'Enviando...' : 'Enviar Comprovativo' }}
      </button>
    </form>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      form: {
        metodo_pagamento: 'mpesa',
        tipo: 'assinatura',
        valor_pago: '',
        referencia: '',
        observacoes: ''
      },
      arquivo: null,
      enviando: false
    };
  },
  methods: {
    selecionarArquivo(event) {
      this.arquivo = event.target.files[0];
    },
    async enviarComprovativo() {
      if (!this.arquivo) {
        alert('Selecione um arquivo');
        return;
      }

      this.enviando = true;

      const formData = new FormData();
      formData.append('comprovativo', this.arquivo);
      formData.append('metodo_pagamento', this.form.metodo_pagamento);
      formData.append('tipo', this.form.tipo);
      formData.append('valor_pago', this.form.valor_pago);
      formData.append('referencia', this.form.referencia);
      formData.append('observacoes', this.form.observacoes);

      try {
        const { data } = await axios.post('/api/comprovativos/enviar', formData, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          }
        });

        alert(data.mensagem);
        this.$router.push('/meus-comprovativos');
      } catch (error) {
        alert(error.response?.data?.mensagem || 'Erro ao enviar');
      } finally {
        this.enviando = false;
      }
    }
  }
};
</script>
```

---

## ✅ Checklist de Implementação

- [x] Modelo `Comprovativo` criado
- [x] Configuração do Cloudinary para comprovativos
- [x] Rota POST `/enviar` com upload via Multer
- [x] Rota GET `/meus` para usuários
- [x] Rota GET `/` para admins (com filtros)
- [x] Rota PUT `/:id/aprovar` para admins
- [x] Rota PUT `/:id/rejeitar` para admins
- [x] Rota DELETE `/:id` para admins
- [x] Notificações push para admins
- [x] Validações de segurança e arquivos
- [x] Registrado no `server.js`

---

## 🎉 Pronto para Usar!

A API está 100% funcional e pronta para ser integrada com o frontend. Todos os endpoints estão protegidos, validados e com notificações configuradas.
