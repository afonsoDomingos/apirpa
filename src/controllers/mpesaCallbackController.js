const xml2js = require("xml2js");
const Pagamento = require("../models/pagamentoModel");

async function mpesaCallbackHandler(req, res) {
  try {
    const rawXml = req.body.toString();
    const parser = new xml2js.Parser({ explicitArray: false });
    const payload = await parser.parseStringPromise(rawXml);

    console.log("📥 Callback recebido da M-Pesa:", payload);

    const response = payload["ns1:processRequestResponse"];
    const output_TransactionID = response.output_TransactionID;
    const output_ResponseCode = response.output_ResponseCode;

    const pago = output_ResponseCode === "INS-0";

    const pagamentoAtualizado = await Pagamento.findOneAndUpdate(
      { "mpesa.transactionId": output_TransactionID },
      {
        status: pago ? "pago" : "cancelado",
        "mpesa.raw": payload,
      },
      { new: true }
    );

    console.log("🧾 Pagamento atualizado:", pagamentoAtualizado ? pagamentoAtualizado : "Nenhum pagamento encontrado para esse transactionId");

    if (!pagamentoAtualizado) {
      console.warn("⚠️  Transacção não encontrada no BD:", output_TransactionID);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("🚨 Erro no callback da M-Pesa:", err);
    return res.status(500).send("Erro interno");
  }
}

module.exports = { mpesaCallbackHandler };
