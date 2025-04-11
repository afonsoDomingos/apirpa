require('dotenv').config(); // Carregar variáveis de ambiente
const express = require('express');
const cors = require('cors'); 

const app = express();
const port = process.env.PORT || 5000;

// Configurar o CORS para permitir requisições da origem http://localhost:3000
app.use(cors({ origin: 'http://localhost:3000' }));

// Middleware para lidar com dados JSON
app.use(express.json());

// Simulando um banco de dados com um array (para testes)
let documentos = [
  { nome_completo: 'João Silva', tipo_documento: 'Bilhete de Identidade', numero_documento: '123456789', provincia: 'Maputo', data_perda: '2025-02-08', origem: 'proprietario', contacto: '+258 84 123 4567' },
  { nome_completo: 'Afonso Domingos', tipo_documento: 'Cartão de Eleitor', numero_documento: '104903847', provincia: 'Maputo', data_perda: '2025-01-07', origem: 'reportado', contacto: '+258 82 987 6543' },
  { nome_completo: 'Maria Souza', tipo_documento: 'Passaporte', numero_documento: '987654321', provincia: 'Beira', data_perda: '2025-02-07', origem: 'proprietario', contacto: '+258 85 456 7890' },
  
  // Novos documentos reportados
  { nome_completo: 'Carlos Almeida', tipo_documento: 'Cartão de Cidadão', numero_documento: '112233445', provincia: 'Nampula', data_perda: '2025-02-09', origem: 'reportado', contacto: '+258 82 111 2222' },
  { nome_completo: 'Ana Costa', tipo_documento: 'Bilhete de Identidade', numero_documento: '556677889', provincia: 'Maputo', data_perda: '2025-02-10', origem: 'reportado', contacto: '+258 84 333 4444' },
  { nome_completo: 'José Marques', tipo_documento: 'Passaporte', numero_documento: '998877665', provincia: 'Beira', data_perda: '2025-02-11', origem: 'reportado', contacto: '+258 85 555 6666' },
  { nome_completo: 'Lúcia Pereira', tipo_documento: 'Cartão de Eleitor', numero_documento: '223344556', provincia: 'Tete', data_perda: '2025-02-12', origem: 'reportado', contacto: '+258 82 777 8888' }
];


// Rota para listar documentos ou buscar por nome/número
app.get('/api/documentos', (req, res) => {

  const { nome_completo, numero_documento } = req.query;
  let resultados = documentos;
  
// Filtra apenas os documentos com origem 'reportado'
//resultados = resultados.filter(doc => doc.origem === 'reportado');

if (nome_completo) {
  resultados = resultados.filter(doc => doc.nome_completo.toLowerCase().includes(nome_completo.toLowerCase()));
}

if (numero_documento) {
  resultados = resultados.filter(doc => doc.numero_documento.includes(numero_documento));
}

res.json(resultados);

  if (nome_completo) {
    resultados = resultados.filter(doc => doc.nome_completo.toLowerCase().includes(nome_completo.toLowerCase()));
  }

  if (numero_documento) {
    resultados = resultados.filter(doc => doc.numero_documento.includes(numero_documento));
  }

  res.json(resultados);
});



// Rota para listar documentos com origem 'reportado'
app.get('/api/documentos/reportados', (req, res) => {
  let { nome_completo, numero_documento } = req.query;
  let resultados = documentos.filter(doc => doc.origem === 'reportado');

  if (nome_completo) {
    resultados = resultados.filter(doc => doc.nome_completo.toLowerCase().includes(nome_completo.toLowerCase()));
  }

  if (numero_documento) {
    resultados = resultados.filter(doc => doc.numero_documento.includes(numero_documento));
  }

  res.json(resultados);
});

// Rota para listar documentos com origem 'proprietario'
app.get('/api/documentos/proprietarios', (req, res) => {
  let { nome_completo, numero_documento } = req.query;
  let resultados = documentos.filter(doc => doc.origem === 'proprietario');

  if (nome_completo) {
    resultados = resultados.filter(doc => doc.nome_completo.toLowerCase().includes(nome_completo.toLowerCase()));
  }

  if (numero_documento) {
    resultados = resultados.filter(doc => doc.numero_documento.includes(numero_documento));
  }

  res.json(resultados);
});

  



// Rota para cadastrar um novo documento perdido ou encontrado
app.post('/api/documentos', (req, res) => {
  const { nome_completo, tipo_documento, numero_documento, provincia, data_perda, origem, contacto } = req.body;

  if (!nome_completo || !tipo_documento || !numero_documento || !provincia || !data_perda || !origem || !contacto) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (!['proprietario', 'reportado'].includes(origem)) {
    return res.status(400).json({ message: 'Origem inválida. Escolha "proprietario" ou "reportado".' });
  }

  const novoDocumento = { nome_completo, tipo_documento, numero_documento, provincia, data_perda, origem, contacto };
  documentos.push(novoDocumento);

  res.status(201).json(novoDocumento);
});


// Rota para atualizar um documento
app.put('/api/documentos/:numero_documento', (req, res) => {
  const { numero_documento } = req.params;
  const { nome_completo, tipo_documento, provincia, data_perda, origem, contacto } = req.body;

  const documentoIndex = documentos.findIndex(doc => doc.numero_documento.toString() === numero_documento.toString());

  if (documentoIndex === -1) {
    return res.status(404).json({ message: 'Documento não encontrado.' });
  }

  if (origem && !['proprietario', 'reportado'].includes(origem)) {
    return res.status(400).json({ message: 'Origem inválida. Escolha "proprietario" ou "reportado".' });
  }

  documentos[documentoIndex] = {
    ...documentos[documentoIndex],
    nome_completo: nome_completo || documentos[documentoIndex].nome_completo,
    tipo_documento: tipo_documento || documentos[documentoIndex].tipo_documento,
    provincia: provincia || documentos[documentoIndex].provincia,
    data_perda: data_perda || documentos[documentoIndex].data_perda,
    origem: origem || documentos[documentoIndex].origem,
    contacto: contacto || documentos[documentoIndex].contacto
  };

  res.json(documentos[documentoIndex]);
});


// Rota para excluir um documento perdido
app.delete('/api/documentos/:numero_documento', (req, res) => {
  const { numero_documento } = req.params;
  const documentoIndex = documentos.findIndex(doc => doc.numero_documento.toString() === numero_documento.toString());

  if (documentoIndex === -1) {
    return res.status(404).json({ message: 'Documento não encontrado.' });
  }

  const documentoRemovido = documentos.splice(documentoIndex, 1);

  res.json({ message: 'Documento excluído com sucesso.', documento: documentoRemovido[0] });
});

// Rota para contar documentos Achados
app.get('/api/documentos/count', (req, res) => {
  try {
    const count = documentos.filter(doc => doc.origem === 'reportado').length;
    res.json({ count });
  } catch (error) {
    console.error('Erro ao contar documentos', error);
    res.status(500).json({ message: 'Erro ao contar documentos' });
  }
});
// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
