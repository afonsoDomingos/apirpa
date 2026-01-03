// ============================================
// INSTRUÇÕES: ATIVAR KEEP-ALIVE
// ============================================
// Cole este código no final do arquivo src/server.js
// ============================================

// 1. No TOPO do arquivo server.js, adicione esta linha com os outros requires:
const { iniciarKeepAlive } = require('./services/keepAlive');

// 2. No FINAL do arquivo, dentro do .then() do connectDB, 
//    APÓS o server.listen(), adicion e esta linha:

connectDB()
    .then(() => {
        console.log("✅ MongoDB conectado com sucesso!");
        server.listen(port, () => {
            console.log("\n====================================");
            console.log(`🚀 Servidor rodando na porta ${port}`);
            console.log("📡 Socket.IO ativo");
            console.log("📍 CAPI: POST /api/facebook/conversion");
            console.log("🟢 API pronta para receber requisições");
            console.log("====================================\n");

            // ⬇️⬇️⬇️ ADICIONAR ESTA LINHA AQUI ⬇️⬇️⬇️
            iniciarKeepAlive();
            // ⬆️⬆️⬆️ ADICIONAR ESTA LINHA AQUI ⬆️⬆️⬆️
        });
    })
    .catch(err => {
        console.error("❌ ERRO AO CONECTAR NO MONGO:", err);
        process.exit(1);
    });

// ============================================
// NÃO ESQUEÇA:
// ============================================
// 1. Adicionar BACKEND_URL no arquivo .env:
//    BACKEND_URL=https://seu-backend.onrender.com
//
// 2. Fazer commit e push:
//    git add .
//    git commit -m "feat: Adicionar keep-alive para evitar cold start"
//    git push
// ============================================
