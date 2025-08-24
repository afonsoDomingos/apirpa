require('dotenv').config();


class Config {
  constructor() {
    this.client_id = process.env.EMOLA_CLIENT_ID;
    this.client_secret = process.env.EMOLA_CLIENT_SECRET;
    this.baseUrl = process.env.EMOLA_BASE_URL;
    this.wallet_id = process.env.EMOLA_WALLET_ID;

    // Debug para garantir que carregou
    console.log("=== EMOLA CONFIG LOADED ===");
    console.log("client_id:", this.client_id || "❌ NÃO DEFINIDO");
    console.log("client_secret:", this.client_secret ? "✅ Carregado" : "❌ NÃO DEFINIDO");
    console.log("baseUrl:", this.baseUrl || "❌ NÃO DEFINIDO");
    console.log("wallet_id:", this.wallet_id || "❌ NÃO DEFINIDO");
    console.log("============================");
  }
}

module.exports = new Config();
