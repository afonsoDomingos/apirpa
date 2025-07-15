// controllers/mpesaCallbackController.js

// Importa o modelo de Pagamento que você acabou de atualizar
const Pagamento = require("../models/pagamentoModel");
// Importa o modelo de Usuário/User que você também atualizou
const Usuario = require("../models/usuarioModel"); // CORRIGIDO: Agora usa 'usuarioModel'

// --- Função Auxiliar para Ativar/Renovar a Assinatura do Usuário ---
// Esta função é chamada apenas quando um pagamento M-Pesa é bem-sucedido.
async function ativarAssinaturaUsuario(usuarioId, pacoteNome) {
    try {
        const user = await Usuario.findById(usuarioId); // Encontra o usuário pelo ID
        if (!user) {
            console.error(`[AtivarAssinatura] Erro: Usuário ${usuarioId} não encontrado para ativar assinatura.`);
            return; // Sai da função se o usuário não for encontrado
        }

        const nomePacoteLower = pacoteNome?.toLowerCase().trim();
        let diasParaAdicionar = 0;

        // Define quantos dias adicionar com base no pacote
        if (nomePacoteLower === "mensal") {
            diasParaAdicionar = 30;
        } else if (nomePacoteLower === "anual") {
            diasParaAdicionar = 365;
        } else {
            console.warn(`[AtivarAssinatura] Aviso: Pacote '${pacoteNome}' desconhecido para o usuário ${usuarioId}. Nenhuma data de validade adicionada.`);
            return; // Sai se o pacote não for reconhecido para adicionar dias
        }

        // Calcula a nova data de expiração da assinatura
        let dataExpiracaoAtual = user.assinaturaExpiracao || new Date(); // Pega a data atual se não houver expiração prévia
        // Se a assinatura atual já expirou (ou está no passado), a nova começa a partir de agora.
        // Isso evita que a adição de dias seja a partir de uma data antiga.
        if (dataExpiracaoAtual < new Date()) {
            dataExpiracaoAtual = new Date();
        }

        // Adiciona os dias ao campo `assinaturaExpiracao` do usuário
        dataExpiracaoAtual.setDate(dataExpiracaoAtual.getDate() + diasParaAdicionar);

        // Atualiza os campos de assinatura no modelo do usuário
        user.assinaturaAtiva = true;
        user.assinaturaExpiracao = dataExpiracaoAtual;
        user.pacoteAtual = pacoteNome; // Define o pacote que está ativo
        // O campo `diasRestantesAssinatura` pode ser um virtual ou ser atualizado aqui
        user.diasRestantesAssinatura = user.diasRestantes; // Se 'diasRestantes' for um virtual, ele recalcula automaticamente

        await user.save(); // Salva as alterações no usuário no banco de dados
        console.log(`[AtivarAssinatura] Sucesso: Assinatura do usuário ${usuarioId} (${pacoteNome}) atualizada para expirar em ${dataExpiracaoAtual.toISOString().split('T')[0]}.`);

    } catch (error) {
        console.error(`[AtivarAssinatura] Erro inesperado ao ativar assinatura para usuário ${usuarioId}:`, error);
    }
}



// --- Handler Principal do Callback M-Pesa ---
const mpesaCallbackHandler = async (req, res) => {
    console.log("======================================");
    console.log("Recebendo callback M-Pesa:", JSON.stringify(req.body, null, 2)); // Loga o callback completo
    console.log("======================================");

    const callbackData = req.body;

    // Validação inicial da estrutura do callback
    if (!callbackData || !callbackData.Body || !callbackData.Body.stkCallback) {
        console.warn("[MpesaCallback] Aviso: Callback M-Pesa com formato inválido ou inesperado.");
        // Sempre retorne 200 OK para o M-Pesa para evitar retransmissões desnecessárias.
        // ResultCode 1 indica que o callback foi recebido, mas com erro no processamento (do seu lado).
        return res.status(200).json({ ResultCode: 1, ResultDesc: "Formato de callback inválido." });
    }

    const stkCallback = callbackData.Body.stkCallback;
    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode; // 0 para sucesso, outros para falha
    const resultDesc = stkCallback.ResultDesc;
    const merchantRequestID = stkCallback.MerchantRequestID; // Para rastreamento adicional



    console.log(`[MpesaCallback] Info: CheckoutRequestID=${checkoutRequestID}, MerchantRequestID=${merchantRequestID}, ResultCode=${resultCode}, ResultDesc=${resultDesc}`);

    try {
        // Encontra o pagamento pendente no seu DB usando o CheckoutRequestID
        const pagamento = await Pagamento.findOne({ "mpesa.checkoutRequestId": checkoutRequestID });

        if (!pagamento) {
            console.warn(`[MpesaCallback] Aviso: Pagamento não encontrado para CheckoutRequestID: ${checkoutRequestID}.`);
            // Retorna ResultCode 0 aqui para M-Pesa parar de retransmitir.
            // O pagamento pode já ter sido processado (duplicado) ou ser de um teste antigo.
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback recebido, mas pagamento não encontrado no DB." });
        }

        // --- Prevenção de Processamento Duplicado ---
        // Verifica se o pagamento já foi marcado como 'pago' ou 'falhou'
        if (pagamento.status === "pago" || pagamento.status === "falhou") {
            console.log(`[MpesaCallback] Info: Pagamento ${pagamento._id} já processado com status '${pagamento.status}'. Ignorando callback duplicado.`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback duplicado ignorado." });
        }

        // Atualiza os campos do callback M-Pesa no objeto `mpesa` do documento de Pagamento
        pagamento.mpesa.resultCode = resultCode;
        pagamento.mpesa.resultDesc = resultDesc;
        pagamento.mpesa.rawCallback = callbackData; // Salva o callback completo para auditoria

        if (resultCode === 0) { // Transação M-Pesa bem-sucedida
            const callbackMetadata = stkCallback.CallbackMetadata;

            if (callbackMetadata && callbackMetadata.Item) {
                // Extrai os detalhes da transação do CallbackMetadata
                const mpesaReceiptNumber = callbackMetadata.Item.find(item => item.Name === "MpesaReceiptNumber")?.Value;
                const transactionDate = callbackMetadata.Item.find(item => item.Name === "TransactionDate")?.Value;
                const amountConfirmed = callbackMetadata.Item.find(item => item.Name === "Amount")?.Value;
                const phoneNumberConfirmed = callbackMetadata.Item.find(item => item.Name === "PhoneNumber")?.Value;

                // Atualiza o status principal do pagamento e detalhes confirmados
                pagamento.status = "pago"; // Altera o status do seu pagamento para 'pago'
                pagamento.mpesa.mpesaStatus = "concluido"; // Status do ciclo de vida M-Pesa
                pagamento.mpesa.mpesaReceiptNumber = mpesaReceiptNumber;
                pagamento.mpesa.transactionDate = transactionDate;
                pagamento.mpesa.amountConfirmed = amountConfirmed;
                pagamento.mpesa.phoneNumberConfirmed = phoneNumberConfirmed;

                console.log(`[MpesaCallback] Sucesso: Pagamento M-Pesa '${mpesaReceiptNumber}' concluído para o usuário '${pagamento.usuario}'.`);

                // --- Lógica CRÍTICA: ATIVAR/RENOVAR A ASSINATURA DO USUÁRIO AQUI ---
                // Chama a função auxiliar para atualizar o modelo de Usuário
                await ativarAssinaturaUsuario(pagamento.usuario, pagamento.pacote);

                // Opcional: Envie notificações para o usuário (email, push notification, etc.)
                // await sendEmail(pagamento.usuario.email, "Pagamento Confirmado!", "Sua assinatura foi ativada.");

            } else {
                console.warn(`[MpesaCallback] Aviso: Callback bem-sucedido (${resultCode}), mas sem CallbackMetadata essencial para CheckoutRequestID: ${checkoutRequestID}.`);
                pagamento.status = "falhou"; // Considerar como falha se dados essenciais estiverem faltando
                pagamento.mpesa.mpesaStatus = "falha";
            }
        } else { // Transação falhou ou foi cancelada pelo usuário
            pagamento.status = "falhou"; // Altera o status do seu pagamento para 'falhou'
            pagamento.mpesa.mpesaStatus = "falha"; // Status do ciclo de vida M-Pesa
            console.log(`[MpesaCallback] Falha: Pagamento M-Pesa falhou para CheckoutRequestID ${checkoutRequestID}: ${resultDesc}.`);
            // Opcional: Notifique o usuário sobre a falha e peça para tentar novamente
            // await sendEmail(pagamento.usuario.email, "Pagamento Falhou", "Por favor, tente novamente.");
        }

        await pagamento.save(); // Salva as alterações no documento de pagamento
        console.log(`[MpesaCallback] Info: Status do pagamento '${pagamento._id}' atualizado para: '${pagamento.status}'`);

        // Resposta para o M-Pesa: 200 OK com ResultCode 0 para indicar que o callback foi
        // *recebido e processado* com sucesso pelo seu sistema.
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback processado com sucesso pelo backend." });

    } catch (error) {
        console.error("[MpesaCallback] Erro interno ao processar callback M-Pesa no backend:", error);
        // Em caso de erro interno no seu backend, retorne ResultCode 1 para M-Pesa
        // (eles podem tentar retransmitir, dependendo da configuração deles)
        return res.status(200).json({ ResultCode: 1, ResultDesc: `Erro interno ao processar callback: ${error.message}` });
    }
};

module.exports = { mpesaCallbackHandler };