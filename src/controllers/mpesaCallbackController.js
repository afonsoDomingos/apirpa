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
        console.error("Corpo bruto recebido (para depuração):", req.body.toString());
        // Retorna 200 OK para M-Pesa para evitar retries infinitos, mas loga o erro
        return res.status(200).send("Erro: Corpo do callback inválido.");
    }

    try {
        // --- Extração de dados do callback ---
        // Adapte os nomes dos campos abaixo conforme a documentação EXATA do callback C2B do M-Pesa Moçambique.
        // O caminho mais comum é diretamente na raiz do objeto ou dentro de uma propriedade 'Result'
        const transactionReference = callbackData.output_ThirdPartyReference || callbackData.ThirdPartyReference; // Prefira output_ThirdPartyReference ou ThirdPartyReference direto
        const resultCode = callbackData.output_ResponseCode || callbackData.ResultCode; // Prefira output_ResponseCode ou ResultCode direto
        const resultDesc = callbackData.output_ResponseDescription || callbackData.ResultDesc; // Prefira output_ResponseDescription ou ResultDesc direto

        // Se a estrutura for mais aninhada como em algumas respostas da M-Pesa (ex: após Transaction Confirm):
        const transactionInfo = callbackData.Result && callbackData.Result.TransactionInfo;
        const fallbackTransactionReference = transactionInfo && transactionInfo.ThirdPartyReference;
        const fallbackResultCode = callbackData.g2Status || (transactionInfo && transactionInfo.Status); // 'g2Status' é comum para confirmação
        const fallbackResultDesc = callbackData.g2ResultDesc || (transactionInfo && transactionInfo.StatusDescription);

        // Usar os valores encontrados, priorizando os mais diretos e depois os aninhados
        const finalTransactionReference = transactionReference || fallbackTransactionReference;
        const finalResultCode = resultCode !== undefined ? resultCode : fallbackResultCode; // Use !== undefined para '0'
        const finalResultDesc = resultDesc || fallbackResultDesc;


        console.log(`Dados extraídos do Callback: Ref=${finalTransactionReference}, Code=${finalResultCode}, Desc=${finalResultDesc}`);


        if (!finalTransactionReference) {
            console.error("ERRO: Callback M-Pesa sem referência de transação válida.", { callbackData });
            return res.status(200).send("Callback M-Pesa recebido, mas referência de transação inválida.");
        }

        const pagamento = await Pagamento.findOne({ 'mpesa.transactionReference': finalTransactionReference });

        if (!pagamento) {
            console.warn(`AVISO: Pagamento não encontrado no DB para a referência M-Pesa: ${finalTransactionReference}.`);
            // É importante ainda retornar 200 OK para o M-Pesa mesmo se não encontrar o pagamento no seu DB,
            // para evitar que eles tentem reenviar o callback.
            return res.status(200).send("Pagamento não encontrado, mas callback M-Pesa recebido.");
        }

        pagamento.mpesa.rawCallback = callbackData; // Salva o payload completo para depuração

        // Assumindo '0' para sucesso na maioria dos casos M-Pesa.
        // Alguns callbacks de sucesso também usam códigos como '000.200.100' ou '0.0.0.0'
        // Consulte a documentação M-Pesa para os códigos de sucesso específicos.
        const isSuccess = finalResultCode === '0' || finalResultCode === '000.200.100' || finalResultCode === '0.0.0.0';

        if (isSuccess) {
            pagamento.status = "pago";
            pagamento.mpesa.mpesaStatus = "sucesso";
            pagamento.mpesa.resultCode = finalResultCode;
            pagamento.mpesa.resultDesc = finalResultDesc;

            // Extraia detalhes da transação confirmada (nomes dos campos dependem da API M-Pesa)
            // Estes são exemplos, ajuste conforme a sua resposta de callback.
            pagamento.mpesa.transactionId = callbackData.output_TransactionID || callbackData.TransactionID || (transactionInfo && transactionInfo.TransactionID);
            pagamento.mpesa.transactionDate = callbackData.output_TransactionDate || callbackData.TransactionDate || (transactionInfo && transactionInfo.TransactionDate);
            pagamento.mpesa.amountConfirmed = callbackData.output_Amount || callbackData.Amount || (transactionInfo && transactionInfo.Amount);
            pagamento.mpesa.phoneNumberConfirmed = callbackData.output_CustomerMSISDN || callbackData.CustomerMSISDN || (transactionInfo && transactionInfo.CustomerMSISDN);

            // Lógica adicional para atualizar a assinatura do usuário aqui, se for o caso
            // Ex: usuario.planoAtivo = true; await usuario.save();
            console.log("SUCESSO: Pagamento M-Pesa confirmado!");

        } else {
            // Se não for sucesso, é uma falha ou um status pendente/cancelado
            pagamento.status = "falhou"; // Ou "cancelado" dependendo do resultCode
            pagamento.mpesa.mpesaStatus = "falha"; // Ou "cancelado"
            pagamento.mpesa.resultCode = finalResultCode;
            pagamento.mpesa.resultDesc = finalResultDesc;
            pagamento.mpesa.erro = finalResultDesc || "Transação não bem-sucedida.";
            console.warn("AVISO: Pagamento M-Pesa não bem-sucedido:", finalResultDesc);
        }

        await pagamento.save();
        console.log(`SUCESSO: Pagamento '${pagamento._id}' atualizado para status '${pagamento.status}' via callback M-Pesa.`);

        // Sempre retorna 200 OK para o M-Pesa, indicando que o callback foi recebido.
        res.status(200).send("Callback M-Pesa recebido e processado com sucesso.");

    } catch (error) {
        console.error("ERRO: Falha no processamento do callback M-Pesa:", error);
        // Em caso de erro interno, ainda retorna 200 OK para o M-Pesa para evitar retries desnecessários
        res.status(200).send("Erro interno ao processar o callback M-Pesa.");
    }
};

module.exports = {
    mpesaCallbackHandler
};