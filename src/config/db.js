const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // 30 segundos para selecionar servidor
      socketTimeoutMS: 45000, // 45 segundos timeout de socket
      maxPoolSize: 10, // Pool de até 10 conexões simultâneas
      minPoolSize: 2, // Manter pelo menos 2 conexões ativas
      maxIdleTimeMS: 60000, // Fechar conexões inativas após 60 segundos
      retryWrites: true, // Retry automático em operações de escrita
      retryReads: true, // Retry automático em operações de leitura
    });
    console.log('✅ MongoDB conectado com sucesso!');
    console.log(`📊 Pool de conexões: min=2, max=10`);
  } catch (err) {
    console.error('❌ Erro ao conectar ao MongoDB:', err.message);
    // Não lança erro, permite servidor iniciar mesmo sem MongoDB
    // Isso evita crash total do servidor
    console.warn('⚠️ Servidor continuará tentando reconectar ao MongoDB...');
  }
};

// Event listeners para monitorar conexão
mongoose.connection.on('connected', () => {
  console.log('🟢 MongoDB: Conexão estabelecida');
});

mongoose.connection.on('disconnected', () => {
  console.log('🔴 MongoDB: Conexão perdida. Tentando reconectar...');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB: Erro de conexão:', err.message);
});

module.exports = connectDB;
