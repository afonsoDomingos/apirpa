const express = require('express');
const router = express.Router();

// Simulando um banco de dados com um array (para testes)
let documentos = [
  { nome_completo: 'João Silva', tipo_documento: 'Bilhete de Identidade', numero_documento: '123456789', provincia: 'Maputo', data_perda: '2025-02-08', origem: 'proprietario', contacto: '+258 84 123 4567' },
  { nome_completo: 'Afonso Domingos', tipo_documento: 'Cartão de Eleitor', numero_documento: '104903847', provincia: 'Maputo', data_perda: '2025-01-07', origem: 'reportado', contacto: '+258 82 987 6543' },
  { nome_completo: 'Maria Souza', tipo_documento: 'Passaporte', numero_documento: '987654321', provincia: 'Beira', data_perda: '2025-02-07', origem: 'proprietario', contacto: '+258 85 456 7890' },
  
  // Novos documentos reportados
  { nome_completo: 'Carlos Almeida', tipo_documento: 'Carta de Condução', numero_documento: '112233445', provincia: 'Nampula', data_perda: '2025-02-09', origem: 'reportado', contacto: '+258 82 111 2222' },
  { nome_completo: 'Ana Costa', tipo_documento: 'Bilhete de Identidade', numero_documento: '556677889', provincia: 'Maputo', data_perda: '2025-02-10', origem: 'reportado', contacto: '+258 84 333 4444' },
  { nome_completo: 'José Marques', tipo_documento: 'Passaporte', numero_documento: '998877665', provincia: 'Beira', data_perda: '2025-02-11', origem: 'reportado', contacto: '+258 85 555 6666' },
  { nome_completo: 'Lúcia Pereira', tipo_documento: 'Cartão de Eleitor', numero_documento: '223344556', provincia: 'Tete', data_perda: '2025-02-12', origem: 'reportado', contacto: '+258 82 777 8888' }
];


//Para Teste//
//http://localhost:5000/api/documentos
//http://localhost:5000/api/documentos/reportados
//http://localhost:5000/api/documentos/proprietarios
//http://localhost:5000/api/documentos/busca
//http://localhost:5000/api/documentos?numero_documento=104903847
//http://localhost:5000/api/documentos?provincia


// Rota para listar documentos ou buscar por nome/número
router.get('/documentos', (req, res) => {
  const { nome_completo, numero_documento, tipo_documento, provincia } = req.query;

  // Filtrando apenas documentos reportados
  let resultados = documentos.filter(doc => doc.origem === "reportado");

  

  // Validação e filtragem
  if (nome_completo) {
    const nomeCompletoLower = nome_completo.toLowerCase();
    resultados = resultados.filter(doc => doc.nome_completo.toLowerCase() === nomeCompletoLower);
  }

  if (numero_documento) {
    resultados = resultados.filter(doc => doc.numero_documento === numero_documento);
  }

  if (tipo_documento) {
    const tipoDocumentoLower = tipo_documento.toLowerCase();
    resultados = resultados.filter(doc => doc.tipo_documento.toLowerCase() === tipoDocumentoLower);
  }
  

  if (provincia) {
    const provinciaLower = provincia.toLowerCase();
    resultados = resultados.filter(doc => doc.provincia.toLowerCase() === provinciaLower);
  }

  

  // Se não houver resultados, retornar uma mensagem informativa
  if (resultados.length === 0) {
    return res.status(404).json({ message: 'Nenhum documento encontrado.' });
  }

  res.json(resultados);
});




// 🟠 Rota para buscar apenas documentos "reportados"
router.get('/documentos/reportados', (req, res) => {
  const resultados = documentos.filter(doc => doc.origem === 'reportado');
  res.status(200).json(resultados);
});

// 🟠 Rota para buscar apenas documentos "proprietario"
router.get('/documentos/proprietarios', (req, res) => {
  const resultados = documentos.filter(doc => doc.origem === 'proprietario');
  res.status(200).json(resultados);
});
// ✏️ Rota para cadastrar um novo documento
router.post('/documentos', (req, res) => {
  const { nome_completo, tipo_documento, numero_documento, provincia, data_perda, origem, contacto } = req.body;

  if (!nome_completo || !tipo_documento || !numero_documento || !provincia || !data_perda || !origem || !contacto) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (!['proprietario', 'reportado'].includes(origem)) {
    return res.status(400).json({ message: 'Origem inválida. Escolha "proprietario" ou "reportado".' });
  }

  const novoDocumento = { 
    nome_completo, 
    tipo_documento, 
    numero_documento: numero_documento.toString(), 
    provincia, 
    data_perda: new Date(data_perda).toISOString().split('T')[0], // Garantindo formato de data
    origem, 
    contacto 
  };

  documentos.push(novoDocumento);

  res.status(201).json(novoDocumento);
});

// 🛠️ Rota para atualizar um documento por número do documento
router.put('/documentos/:numero_documento', (req, res) => {
  const { numero_documento } = req.params;
  const { nome_completo, tipo_documento, provincia, data_perda, origem, contacto } = req.body;

  const index = documentos.findIndex(doc => doc.numero_documento === numero_documento);

  if (index === -1) {
    return res.status(404).json({ message: 'Documento não encontrado.' });
  }

  if (origem && !['proprietario', 'reportado'].includes(origem)) {
    return res.status(400).json({ message: 'Origem inválida. Escolha "proprietario" ou "reportado".' });
  }

  documentos[index] = {
    ...documentos[index],
    nome_completo: nome_completo || documentos[index].nome_completo,
    tipo_documento: tipo_documento || documentos[index].tipo_documento,
    provincia: provincia || documentos[index].provincia,
    data_perda: data_perda ? new Date(data_perda).toISOString().split('T')[0] : documentos[index].data_perda,
    origem: origem || documentos[index].origem,
    contacto: contacto || documentos[index].contacto
  };

  res.status(200).json(documentos[index]);
});

// 🗑️ Rota para deletar um documento
router.delete('/documentos/:numero_documento', (req, res) => {
  const { numero_documento } = req.params;
  const index = documentos.findIndex(doc => doc.numero_documento === numero_documento);

  if (index === -1) {
    return res.status(404).json({ message: 'Documento não encontrado.' });
  }

  const documentoRemovido = documentos.splice(index, 1);

  res.status(200).json({ message: 'Documento excluído com sucesso.', documento: documentoRemovido[0] });
});

// 📊 Contar quantos documentos foram reportados
router.get('/documentos/count', (req, res) => {
  const count = documentos.filter(doc => doc.origem === 'reportado').length;
  res.status(200).json({ count });
});

module.exports = router;
