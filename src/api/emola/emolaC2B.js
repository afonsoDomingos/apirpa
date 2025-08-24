const axios = require("axios");
const config = require("./config");

class EmolaC2B {
  constructor() {
    this.token = null;
  }

  // 🔑 1. Gerar token usando client_id e client_secret
  async getToken() {
    try {
      const url = `${config.baseUrl}/v1/auth/token`;
      console.log("[EmolaC2B] Gerando token em:", url);

      const response = await axios.post(
        url,
        {
          client_id: config.client_id,
          client_secret: config.client_secret,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      this.token = response.data.access_token;
      console.log("[EmolaC2B] Token gerado com sucesso ✅:", this.token);
      return this.token;
    } catch (err) {
      console.error(
        "[EmolaC2B] Erro a gerar token ❌:",
        err.response?.status,
        err.response?.data || err.message
      );
      return null;
    }
  }

  // 💳 2. Fazer pagamento C2B
  async payment(phone, amount, reference = "TesteRpa") {
    try {
      // Se não há token, gerar
      if (!this.token) {
        console.log("[EmolaC2B] Nenhum token em cache, a gerar novo...");
        await this.getToken();
      }

      if (!this.token) {
        throw new Error("Não foi possível obter token de autenticação");
      }

      const payload = {
        client_id: config.client_id,
        phone: phone.slice(-9), // últimos 9 dígitos
        amount,
        reference,
      };

      const endpoint = `${config.baseUrl}/v1/c2b/mpesa-payment/${config.wallet_id}`;

      console.log("[EmolaC2B] Iniciando pagamento...");
      console.log("➡️ Endpoint:", endpoint);
      console.log("➡️ Payload:", payload);

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      console.log("[EmolaC2B] Sucesso ✅:", response.data);
      return { status: "success", data: response.data };
    } catch (err) {
      console.error(
        "[EmolaC2B] Erro API ❌:",
        err.response?.status,
        err.response?.data || err.message
      );
      return { status: "error", message: err.response?.data || err.message };
    }
  }
}

module.exports = new EmolaC2B();
