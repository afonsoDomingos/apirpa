const xml2js = require("xml2js");
const Pagamento = require("../models/pagamentoModel");

async function mpesaCallbackHandler(req, res) {
  try {
    const rawXml = req.body.toString(); // Converte o buffer para string
    const parser = new xml2js.Parser({ explicitArray: false });

    const result = await parser.parseStringPromise(rawXml);

    console.log("📥 Callback recebido da M-Pesa:", result);

    const response = result["ns1:processRequestResponse"];
    const output_TransactionID = response.output_TransactionID;
    const output_ResponseCode = response.output_ResponseCode;

    const pago = output_ResponseCode === "INS-0";

    const pagamentoAtualizado = await Pagamento.findOneAndUpdate(
      { "mpesa.transactionId": output_TransactionID },
      { status: pago ? "pago" : "cancelado" },
      { new: true }
    );

    console.log("🧾 Pagamento atualizado:", pagamentoAtualizado);

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Erro no callback da M-Pesa:", err);
    res.status(500).send("Erro interno");
  }
}

module.exports = { mpesaCallbackHandler };
