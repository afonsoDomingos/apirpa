// controllers/mpesaCallbackController.js
const xml2js = require("xml2js");  // npm install xml2js
const Pagamento = require("../models/pagamentoModel");

/**
 * Handler que recebe o callback C2B da Vodacom M‑Pesa
 * Pode vir como XML (mais comum) ou JSON.
 */
async function mpesaCallbackHandler(req, res) {
  try {
    let payload = req.body;

    // 1) Se vier em XML (string), converte para JSON
    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
      payload = await xml2js.parseStringPromise(req.body, { explicitArray: false });
    }

    // 2) Há duas variações de chave, então normalizamos:
    const {
      output_TransactionID,
      output_ResponseCode,
    } = payload;

    console.log("📥 Callback recebido da M‑Pesa:", payload);

    // 3) Decide status
    const pago = output_ResponseCode === "INS-0";

    // 4) Actualiza o documento
    const pagamentoAtualizado = await Pagamento.findOneAndUpdate(
      { "mpesa.transactionId": output_TransactionID },
      {
        status: pago ? "pago" : "cancelado",
        "mpesa.raw": payload,          // guarda resposta bruta (opcional, útil p/ auditoria)
      },
      { new: true }
    );

    if (!pagamentoAtualizado) {
      console.warn("⚠️  Transacção não encontrada no BD:", output_TransactionID);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("🚨 Erro no callback da M‑Pesa:", err);
    return res.status(500).send("Erro interno");
  }
}

module.exports = { mpesaCallbackHandler };
