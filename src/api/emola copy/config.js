require('dotenv').config();

class Config {
  constructor() {
    this.username = process.env.EMOLA_USERNAME;
    this.password = process.env.EMOLA_PASSWORD;
    this.baseUrl = process.env.EMOLA_BASE_URL;

    // Debug para garantir que carregou
    console.log("=== EMOLA CONFIG LOADED ===");
    console.log("username:", this.username || "❌ NÃO DEFINIDO");
    console.log("password:", this.password ? "✅ Carregado" : "❌ NÃO DEFINIDO");
    console.log("baseUrl:", this.baseUrl || "❌ NÃO DEFINIDO");
    console.log("DEBUG BASE_URL:", this.baseUrl);
    console.log("============================");
  }
}

module.exports = new Config();