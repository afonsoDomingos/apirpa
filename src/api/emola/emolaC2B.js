const soap = require('soap');
const config = require('./config');

class EmolaC2B {
  async payment(msisdn, amount) {
    const transId = `C2B_${Date.now()}`;
    const refNo = `REF_${Date.now()}`;

    try {
      const url = config.wsdl;
      const client = await soap.createClientAsync(url);

      const args = {
        Input: {
          username: config.username,
          password: config.password,
          wscode: "pushUssdMessage",
          param: [
            { $attributes: { name: "partnerCode" }, $value: config.partnerCode },
            { $attributes: { name: "msisdn" }, $value: msisdn },
            { $attributes: { name: "smsContent" }, $value: "Pagamento de serviço" },
            { $attributes: { name: "transAmount" }, $value: amount },
            { $attributes: { name: "transId" }, $value: transId },
            { $attributes: { name: "language" }, $value: "pt" },
            { $attributes: { name: "refNo" }, $value: refNo },
            { $attributes: { name: "key" }, $value: config.privateKey }
          ],
          rawData: ""
        }
      };

      const [result] = await client.gwOperationAsync(args);

      return {
        status: result?.Result?.error === "0" ? "success" : "fail",
        data: result,
        transId,
        refNo
      };

    } catch (err) {
      console.error("Erro no EmolaC2B.payment:", err);
      return { status: "fail", error: err.message };
    }
  }
}

module.exports = new EmolaC2B();
