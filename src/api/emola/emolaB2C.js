const soap = require('soap');
const config = require('./config');

class EmolaB2C {
  async payment(msisdn, amount) {
    const transId = `B2C_${Date.now()}`;

    try {
      const url = config.wsdl;
      const client = await soap.createClientAsync(url);

      const args = {
        Input: {
          username: config.username,
          password: config.password,
          wscode: "pushUssdDisbursementB2C",
          param: [
            { $attributes: { name: "partnerCode" }, $value: config.partnerCode },
            { $attributes: { name: "msisdn" }, $value: msisdn },
            { $attributes: { name: "smsContent" }, $value: "Pagamento da empresa" },
            { $attributes: { name: "transAmount" }, $value: amount },
            { $attributes: { name: "transId" }, $value: transId },
            { $attributes: { name: "key" }, $value: config.privateKey }
          ],
          rawData: ""
        }
      };

      const [result] = await client.gwOperationAsync(args);

      return {
        status: result?.Result?.error === "0" ? "success" : "fail",
        data: result,
        transId
      };

    } catch (err) {
      console.error("Erro no EmolaB2C.payment:", err);
      return { status: "fail", error: err.message };
    }
  }
}

module.exports = new EmolaB2C();
