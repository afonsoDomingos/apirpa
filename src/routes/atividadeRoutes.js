const express = require('express');
const router = express.Router();
const Atividade = require('../models/atividadeModel');
const verificarToken = require('../middleware/authMiddleware');

/**
 * @route   POST /api/atividades
 * @desc    Registar uma nova atividade
 * @access  Private
 */
router.post('/', verificarToken, async (req, res) => {
    const timestamp = new Date().toLocaleString('pt-MZ');
    console.log(`\n[${timestamp}] 📩 [POST /api/atividades] Nova atividade recebida:`, req.body);
    console.log(`[${timestamp}] 👤 Usuário solicitante: ${req.usuario.id} (${req.usuario.role})`);

    const { setorId, titulo, descricao, status, data } = req.body;

    if (!setorId || !titulo || !descricao) {
        console.log('⚠️ [POST /api/atividades] Falha: Campos obrigatórios ausentes');
        return res.status(400).json({
            success: false,
            message: 'Setor, título e descrição são obrigatórios.'
        });
    }

    try {
        const novaAtividade = new Atividade({
            setorId,
            titulo,
            descricao,
            status: status || 'Pendente',
            data: data || Date.now(),
            usuario: req.usuario.id // Associado automaticamente pelo middleware
        });

        await novaAtividade.save();

        console.log('✅ [POST /api/atividades] Atividade salva com sucesso! ID:', novaAtividade._id);

        res.status(201).json({
            success: true,
            message: 'Atividade registrada com sucesso.',
            data: novaAtividade
        });
    } catch (err) {
        console.error('❌ [POST /api/atividades] Erro ao salvar atividade:', err.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao registrar atividade.',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/atividades
 * @desc    Listar atividades (Admin vê tudo/filtra, Colaborador vê apenas as suas)
 * @access  Private
 */
router.get('/', verificarToken, async (req, res) => {
    const timestamp = new Date().toLocaleString('pt-MZ');
    const { usuarioId, setorId } = req.query;
    const { id: currentUserId, role } = req.usuario;

    console.log(`\n[${timestamp}] 🔍 [GET /api/atividades] Buscando atividades.`);
    console.log(`[${timestamp}] 🛂 User: ${currentUserId} | Role: ${role}`);
    if (usuarioId || setorId) {
        console.log(`[${timestamp}] ⚙️ Filtros aplicados - usuarioId: ${usuarioId || 'nenhum'}, setorId: ${setorId || 'nenhum'}`);
    }

    try {
        let query = {};

        // Lógica de permissão
        if (role === 'admin' || role === 'SuperAdmin') {
            // Admin pode filtrar por usuário ou setor
            if (usuarioId) query.usuario = usuarioId;
            if (setorId) query.setorId = setorId;
        } else {
            // Colaborador comum vê apenas as suas
            query.usuario = currentUserId;
        }

        const atividades = await Atividade.find(query)
            .populate('usuario', 'nome email')
            .sort({ data: -1 });

        console.log(`✅ [GET /api/atividades] Encontradas ${atividades.length} atividades.`);
        res.status(200).json(atividades);
    } catch (err) {
        console.error('❌ [GET /api/atividades] Erro ao buscar atividades:', err.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar atividades.',
            error: err.message
        });
    }
});

/**
 * @route   PATCH /api/atividades/:id
 * @desc    Atualizar status ou descrição de uma atividade
 * @access  Private
 */
router.patch('/:id', verificarToken, async (req, res) => {
    const timestamp = new Date().toLocaleString('pt-MZ');
    const { id } = req.params;
    const { status, descricao } = req.body;
    const { id: currentUserId, role } = req.usuario;

    console.log(`\n[${timestamp}] 📝 [PATCH /api/atividades/${id}] Tentativa de atualização.`);
    console.log(`[${timestamp}] 👤 User: ${currentUserId} | Payload:`, req.body);

    try {
        const atividade = await Atividade.findById(id);

        if (!atividade) {
            console.log(`⚠️ [PATCH /api/atividades/${id}] Atividade não encontrada.`);
            return res.status(404).json({ success: false, message: 'Atividade não encontrada.' });
        }

        // Verificar permissão: Dono da atividade ou Admin
        if (atividade.usuario.toString() !== currentUserId && role !== 'admin' && role !== 'SuperAdmin') {
            console.log(`⛔ [PATCH /api/atividades/${id}] Acesso negado para o usuário ${currentUserId}`);
            return res.status(403).json({ success: false, message: 'Você não tem permissão para atualizar esta atividade.' });
        }

        // Atualizar campos permitidos
        if (status) atividade.status = status;
        if (descricao) atividade.descricao = descricao;

        await atividade.save();

        console.log(`✅ [PATCH /api/atividades/${id}] Atividade atualizada com sucesso!`);

        res.status(200).json({
            success: true,
            message: 'Atividade atualizada com sucesso.',
            data: atividade
        });
    } catch (err) {
        console.error(`❌ [PATCH /api/atividades/${id}] Erro ao atualizar:`, err.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar atividade.',
            error: err.message
        });
    }
});

/**
 * @route   DELETE /api/atividades/:id
 * @desc    Remover uma atividade
 * @access  Private
 */
router.delete('/:id', verificarToken, async (req, res) => {
    const timestamp = new Date().toLocaleString('pt-MZ');
    const { id } = req.params;
    const { id: currentUserId, role } = req.usuario;

    console.log(`\n[${timestamp}] 🗑️ [DELETE /api/atividades/${id}] Tentativa de remoção por ${currentUserId} (${role})`);

    try {
        const atividade = await Atividade.findById(id);

        if (!atividade) {
            console.log(`⚠️ [DELETE /api/atividades/${id}] Atividade não encontrada.`);
            return res.status(404).json({ success: false, message: 'Atividade não encontrada.' });
        }

        // Verificar permissão: Dono da atividade ou Admin
        if (atividade.usuario.toString() !== currentUserId && role !== 'admin' && role !== 'SuperAdmin') {
            console.log(`⛔ [DELETE /api/atividades/${id}] Acesso negado.`);
            return res.status(403).json({ success: false, message: 'Você não tem permissão para remover esta atividade.' });
        }

        await Atividade.findByIdAndDelete(id);

        console.log(`✅ [DELETE /api/atividades/${id}] Atividade removida.`);

        res.status(200).json({ success: true, message: 'Atividade removida com sucesso.' });
    } catch (err) {
        console.error(`❌ [DELETE /api/atividades/${id}] Erro ao remover:`, err.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover atividade.',
            error: err.message
        });
    }
});

module.exports = router;
