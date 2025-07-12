require("dotenv").config();
const mpesa = require("mpesa-node-api");

mpesa.initializeApi({
  baseUrl:   process.env.MPESA_API_HOST,
  apiKey:    process.env.MPESA_API_KEY,
  publicKey: process.env.MPESA_PUBLIC_KEY,
  origin:    process.env.MPESA_ORIGIN,
  serviceProviderCode: process.env.MPESA_SP_CODE,
});

async function iniciarC2B({ amount, msisdn, ref }) {
  try {
    const response = await mpesa.initiate_c2b(amount, msisdn, ref, ref);
    return response;
  } catch (error) {
    console.error("Erro ao iniciar pagamento M-Pesa:", error);
    throw error;
  }
}

module.exports = { iniciarC2B };
