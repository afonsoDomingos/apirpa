// controllers/mpesaCallbackController.js
const Pagamento = require("../models/pagamentoModel"); // Seu modelo de pagamento

const mpesaCallbackHandler = async (req, res) => {
    console.log("======================================");
    console.log("Recebendo callback M-Pesa:", JSON.stringify(req.body, null, 2));
    console.log("======================================");

    const callbackData = req.body;

    // Verifique se é um callback de STK Push e se a estrutura está presente
    if (!callbackData || !callbackData.Body || !callbackData.Body.stkCallback) {
        console.warn("Callback M-Pesa com formato inválido ou inesperado.");
        // Sempre retorne 200 OK para o M-Pesa para evitar retransmissões.
        return res.status(200).json({ ResultCode: 1, ResultDesc: "Formato de callback inválido." });
    }

    const stkCallback = callbackData.Body.stkCallback;
    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode; // 0 para sucesso, outros para falha
    const resultDesc = stkCallback.ResultDesc;

    try {
        // Encontre o pagamento pendente no seu DB usando o CheckoutRequestID
        const pagamento = await Pagamento.findOne({ "mpesa.checkoutRequestId": checkoutRequestID });

        if (!pagamento) {
            console.warn(`Pagamento não encontrado para CheckoutRequestID: ${checkoutRequestID}.`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback recebido, pagamento não encontrado em DB." });
        }

        pagamento.mpesa.resultCode = resultCode;
        pagamento.mpesa.resultDesc = resultDesc;
        pagamento.mpesa.rawCallback = callbackData; // Salvar o callback completo para auditoria

        if (resultCode === 0) { // Transação bem-sucedida
            const callbackMetadata = stkCallback.CallbackMetadata;
            if (callbackMetadata && callbackMetadata.Item) {
                const mpesaReceiptNumber = callbackMetadata.Item.find(item => item.Name === "MpesaReceiptNumber")?.Value;
                const transactionDate = callbackMetadata.Item.find(item => item.Name === "TransactionDate")?.Value;
                const amountConfirmed = callbackMetadata.Item.find(item => item.Name === "Amount")?.Value;
                const phoneNumberConfirmed = callbackMetadata.Item.find(item => item.Name === "PhoneNumber")?.Value;

                pagamento.status = "pago";
                pagamento.mpesa.transactionId = mpesaReceiptNumber;
                pagamento.mpesa.transactionDate = transactionDate;
                pagamento.mpesa.amountConfirmed = amountConfirmed;
                pagamento.mpesa.phoneNumberConfirmed = phoneNumberConfirmed;

                // *** LÓGICA CRÍTICA: ATIVAR/RENOVAR A ASSINATURA DO USUÁRIO AQUI ***
                // Exemplo: Atualizar um campo no modelo de usuário ou no próprio pagamento
                // para indicar que a assinatura está ativa e definir a data de expiração.
                console.log(`Pagamento M-Pesa ${mpesaReceiptNumber} concluído com sucesso para o usuário ${pagamento.usuario}.`);
                // Envie notificação para o usuário (email, push notification)
            } else {
                console.warn(`Callback bem-sucedido (${resultCode}), mas sem CallbackMetadata para CheckoutRequestID: ${checkoutRequestID}.`);
                // Considerar como falha ou necessitar de verificação manual se dados essenciais estiverem faltando
                pagamento.status = "falhou_parcialmente"; // Ou outro status que indique necessidade de revisão
            }
        } else { // Transação falhou ou foi cancelada
            pagamento.status = "falhou";
            console.log(`Pagamento M-Pesa falhou para CheckoutRequestID ${checkoutRequestID}: ${resultDesc}.`);
            // Notifique o usuário sobre a falha e peça para tentar novamente
        }

        await pagamento.save();

        return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback processado com sucesso." });

    } catch (error) {
        console.error("Erro ao processar callback M-Pesa no backend:", error);
        return res.status(200).json({ ResultCode: 1, ResultDesc: "Erro interno ao processar callback." });
    }
};

module.exports = { mpesaCallbackHandler };