// controllers/mpesaCallbackController.js
const Pagamento = require("../models/pagamentoModel"); // Importa o modelo de pagamento

/**
 * Lida com as notificações de callback M-Pesa C2B recebidas.
 * Este endpoint é chamado pelo M-Pesa para notificar o sistema sobre o status final do pagamento.
 * @param {object} req - Objeto de requisição Express.
 * @param {object} res - Objeto de resposta Express.
 */
const mpesaCallbackHandler = async (req, res) => {
    console.log("--- Callback M-Pesa Recebido ---");
    let callbackData;

    try {
        // Tenta parsear o corpo bruto (Buffer) para JSON
        callbackData = JSON.parse(req.body.toString());
        console.log("Payload do Callback M-Pesa (JSON):", JSON.stringify(callbackData, null, 2));
    } catch (parseError) {
        console.error("ERRO: Falha ao parsear o corpo do callback M-Pesa para JSON:", parseError.message);
        console.error("Corpo bruto recebido:", req.body.toString());
        // Retorna 200 OK para M-Pesa para evitar retries, mas loga o erro
        return res.status(200).send("Erro: Corpo do callback inválido.");
    }

    try {
        // Tenta extrair a referência da transação. Os nomes dos campos podem variar.
        // Consulte a documentação de callback C2B do M-Pesa para os nomes exatos.
        const transactionReference = callbackData.output_ThirdPartyReference ||
                                     (callbackData.Result && callbackData.Result.ThirdPartyReference) ||
                                     (callbackData.Result && callbackData.Result.TransactionInfo && callbackData.Result.TransactionInfo.ThirdPartyReference);

        const resultCode = callbackData.output_ResponseCode ||
                           (callbackData.Result && callbackData.Result.ResultCode);

        const resultDesc = callbackData.output_ResponseDescription ||
                           (callbackData.Result && callbackData.Result.ResultDesc);

        if (!transactionReference) {
            console.error("ERRO: Callback M-Pesa sem referência de transação válida:", callbackData);
            return res.status(200).send("Callback M-Pesa recebido, mas referência de transação inválida.");
        }

        const pagamento = await Pagamento.findOne({ 'mpesa.transactionReference': transactionReference });

        if (!pagamento) {
            console.warn(`AVISO: Pagamento não encontrado no DB para a referência M-Pesa: ${transactionReference}`);
            return res.status(200).send("Pagamento não encontrado, mas callback M-Pesa recebido.");
        }

        pagamento.mpesa.rawCallback = callbackData; // Salva o payload completo para depuração

        if (resultCode === '0') { // Assumindo '0' significa sucesso
            pagamento.status = "pago";
            pagamento.mpesa.mpesaStatus = "sucesso";
            pagamento.mpesa.resultCode = resultCode;
            pagamento.mpesa.resultDesc = resultDesc;

            // Extraia detalhes da transação confirmada (nomes dos campos dependem da API M-Pesa)
            pagamento.mpesa.transactionId = callbackData.Result.TransactionID || (callbackData.Result.TransactionInfo && callbackData.Result.TransactionInfo.TransactionID);
            pagamento.mpesa.transactionDate = callbackData.Result.TransactionDate || (callbackData.Result.TransactionInfo && callbackData.Result.TransactionInfo.TransactionDate);
            pagamento.mpesa.amountConfirmed = callbackData.Result.Amount || (callbackData.Result.TransactionInfo && callbackData.Result.TransactionInfo.Amount);
            pagamento.mpesa.phoneNumberConfirmed = callbackData.Result.CustomerMSISDN || (callbackData.Result.TransactionInfo && callbackData.Result.TransactionInfo.CustomerMSISDN);
            // Lógica para atualizar a assinatura do usuário aqui, se for o caso
        } else {
            pagamento.status = "falhou";
            pagamento.mpesa.mpesaStatus = "falha";
            pagamento.mpesa.resultCode = resultCode;
            pagamento.mpesa.resultDesc = resultDesc;
            pagamento.mpesa.erro = resultDesc;
        }

        await pagamento.save();
        console.log(`SUCESSO: Pagamento '${pagamento._id}' atualizado para status '${pagamento.status}' via callback M-Pesa.`);

        res.status(200).send("Callback M-Pesa recebido e processado com sucesso.");

    } catch (error) {
        console.error("ERRO: Falha no processamento do callback M-Pesa:", error);
        res.status(200).send("Erro interno ao processar o callback M-Pesa.");
    }
};

module.exports = {
    mpesaCallbackHandler
};