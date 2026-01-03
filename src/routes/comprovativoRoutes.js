// routes/comprovativoRoutes.js
const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const Comprovativo = require('../models/comprovativoModel');
const Pagamento = require('../models/pagamentoModel');
const Usuario = require('../models/usuarioModel');
const multer = require('multer');
const { storageComprovativos } = require('../config/cloudinary');
const { notificarAdmin } = require('../services/notificationService');

// Configuração do upload com Multer + Cloudinary
const upload = multer({
    storage: storageComprovativos,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de arquivo inválido. Apenas imagens (JPG, PNG, WEBP) ou PDF são permitidos.'));
        }
    }
});

// ==============================================================
// 1. ENVIAR COMPROVATIVO DE PAGAMENTO (USUÁRIO)
// ==============================================================
router.post(
    '/enviar',
    verificarToken,
    upload.single('comprovativo'),
    async (req, res) => {
        try {
            const {
                metodo_pagamento,
                valor_pago,
                referencia,
                observacoes,
                tipo
            } = req.body;

            // Validações
            if (!metodo_pagamento || !valor_pago || !referencia || !tipo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Dados incompletos. Preencha todos os campos obrigatórios.'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Comprovativo é obrigatório. Envie uma imagem ou PDF.'
                });
            }

            // Validar valor
            const valorNumerico = parseFloat(valor_pago);
            if (isNaN(valorNumerico) || valorNumerico <= 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: 'Valor inválido. Insira um valor maior que zero.'
                });
            }

            // Criar comprovativo no banco de dados
            const comprovativo = await Comprovativo.create({
                usuarioId: req.usuario.id,
                metodo_pagamento,
                valor_pago: valorNumerico,
                referencia: referencia.trim(),
                observacoes: observacoes ? observacoes.trim() : null,
                tipo,
                arquivo_path: req.file.path, // URL do Cloudinary
                status: 'pendente'
            });

            // Popular informações do usuário
            await comprovativo.populate('usuarioId', 'nome email');

            // 🔔 NOTIFICAR ADMIN (em background, não bloqueia a resposta)
            Usuario.findById(req.usuario.id).then(user => {
                notificarAdmin({
                    title: '📄 Novo Comprovativo Recebido',
                    icon: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/uploads/notification-icon.png` : '/uploads/notification-icon.png',
                    body: `${user?.nome || 'Usuário'} enviou um comprovativo de ${valorNumerico.toFixed(2)} MZN (${metodo_pagamento}).`,
                    data: {
                        url: '/admin/comprovativos',
                        valor: valorNumerico,
                        usuario: user?.nome,
                        tipo: tipo,
                        comprovativoId: comprovativo._id
                    }
                }).catch(err => console.error('Erro ao enviar notificação push:', err));
            });

            res.status(201).json({
                sucesso: true,
                mensagem: 'Comprovativo recebido com sucesso! Aguarde a análise do administrador.',
                comprovativo: {
                    id: comprovativo._id,
                    metodo_pagamento: comprovativo.metodo_pagamento,
                    valor_pago: comprovativo.valor_pago,
                    referencia: comprovativo.referencia,
                    tipo: comprovativo.tipo,
                    status: comprovativo.status,
                    arquivo_url: comprovativo.arquivo_path,
                    createdAt: comprovativo.createdAt
                }
            });

        } catch (error) {
            console.error('ERRO AO RECEBER COMPROVATIVO:', error);

            // Tratamento de erro do Multer
            if (error.message.includes('Formato de arquivo inválido')) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: error.message
                });
            }

            return res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao processar comprovativo. Tente novamente.',
                erro: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// ==============================================================
// 2. LISTAR MEUS COMPROVATIVOS (USUÁRIO)
// ==============================================================
router.get('/meus', verificarToken, async (req, res) => {
    try {
        const comprovativos = await Comprovativo.find({ usuarioId: req.usuario.id })
            .sort({ createdAt: -1 })
            .select('-__v')
            .limit(50);

        res.json({
            sucesso: true,
            total: comprovativos.length,
            comprovativos: comprovativos.map(c => ({
                id: c._id,
                metodo_pagamento: c.metodo_pagamento,
                tipo: c.tipo,
                valor_pago: c.valor_pago,
                referencia: c.referencia,
                observacoes: c.observacoes,
                status: c.status,
                arquivo_url: c.arquivo_path,
                observacoes_admin: c.observacoes_admin,
                data_analise: c.data_analise,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar comprovativos do usuário:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao carregar seus comprovativos.'
        });
    }
});

// ==============================================================
// 3. ADMIN: LISTAR TODOS OS COMPROVATIVOS
// ==============================================================
router.get('/', verificarToken, async (req, res) => {
    if (req.usuario.role !== 'admin' && req.usuario.role !== 'SuperAdmin') {
        return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado.' });
    }

    try {
        const { status, metodo_pagamento, tipo, busca } = req.query;

        // Construir filtros
        const filtros = {};

        if (status) filtros.status = status;
        if (metodo_pagamento) filtros.metodo_pagamento = metodo_pagamento;
        if (tipo) filtros.tipo = tipo;

        // Busca por referência ou nome do usuário
        if (busca) {
            const usuarios = await Usuario.find({
                $or: [
                    { nome: { $regex: busca, $options: 'i' } },
                    { email: { $regex: busca, $options: 'i' } }
                ]
            }).select('_id');

            const usuarioIds = usuarios.map(u => u._id);

            filtros.$or = [
                { referencia: { $regex: busca, $options: 'i' } },
                { usuarioId: { $in: usuarioIds } }
            ];
        }

        const comprovativos = await Comprovativo.find(filtros)
            .populate('usuarioId', 'nome email')
            .populate('admin_responsavel', 'nome email')
            .sort({ createdAt: -1 })
            .limit(200);

        res.json({
            sucesso: true,
            total: comprovativos.length,
            comprovativos: comprovativos.map(c => ({
                id: c._id,
                usuario: c.usuarioId ? {
                    id: c.usuarioId._id,
                    nome: c.usuarioId.nome,
                    email: c.usuarioId.email
                } : null,
                metodo_pagamento: c.metodo_pagamento,
                tipo: c.tipo,
                valor_pago: c.valor_pago,
                referencia: c.referencia,
                observacoes: c.observacoes,
                status: c.status,
                arquivo_url: c.arquivo_path,
                observacoes_admin: c.observacoes_admin,
                data_analise: c.data_analise,
                admin_responsavel: c.admin_responsavel ? {
                    id: c.admin_responsavel._id,
                    nome: c.admin_responsavel.nome
                } : null,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt
            }))
        });

    } catch (error) {
        console.error('Erro ADMIN ao buscar comprovativos:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao carregar comprovativos.'
        });
    }
});

// ==============================================================
// 4. ADMIN: APROVAR COMPROVATIVO
// ==============================================================
router.put('/:id/aprovar', verificarToken, async (req, res) => {
    if (req.usuario.role !== 'admin' && req.usuario.role !== 'SuperAdmin') {
        return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado.' });
    }

    try {
        const { id } = req.params;
        const { observacoes_admin } = req.body;

        const comprovativo = await Comprovativo.findById(id).populate('usuarioId', 'nome email');

        if (!comprovativo) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Comprovativo não encontrado.'
            });
        }

        if (comprovativo.status === 'aprovado') {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Este comprovativo já foi aprovado.'
            });
        }

        // Atualizar comprovativo
        comprovativo.status = 'aprovado';
        comprovativo.observacoes_admin = observacoes_admin || null;
        comprovativo.data_analise = new Date();
        comprovativo.admin_responsavel = req.usuario.id;
        await comprovativo.save();

        // TODO: Aqui você pode criar automaticamente um pagamento aprovado
        // Exemplo:
        /*
        const novoPagamento = await Pagamento.create({
          usuarioId: comprovativo.usuarioId._id,
          pacote: comprovativo.tipo, // ou mapear conforme necessário
          metodoPagamento: comprovativo.metodo_pagamento,
          valor: comprovativo.valor_pago,
          status: 'aprovado',
          tipoPagamento: comprovativo.tipo,
          dataPagamento: new Date(),
          referencia: comprovativo.referencia,
          gatewayResponse: { message: 'Aprovado via comprovativo manual' }
        });
        */

        res.json({
            sucesso: true,
            mensagem: 'Comprovativo aprovado com sucesso!',
            comprovativo: {
                id: comprovativo._id,
                status: comprovativo.status,
                data_analise: comprovativo.data_analise,
                observacoes_admin: comprovativo.observacoes_admin
            }
        });

    } catch (error) {
        console.error('Erro ao aprovar comprovativo:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao aprovar comprovativo.'
        });
    }
});

// ==============================================================
// 5. ADMIN: REJEITAR COMPROVATIVO
// ==============================================================
router.put('/:id/rejeitar', verificarToken, async (req, res) => {
    if (req.usuario.role !== 'admin' && req.usuario.role !== 'SuperAdmin') {
        return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado.' });
    }

    try {
        const { id } = req.params;
        const { observacoes_admin } = req.body;

        if (!observacoes_admin || !observacoes_admin.trim()) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Observações são obrigatórias ao rejeitar um comprovativo.'
            });
        }

        const comprovativo = await Comprovativo.findById(id).populate('usuarioId', 'nome email');

        if (!comprovativo) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Comprovativo não encontrado.'
            });
        }

        // Atualizar comprovativo
        comprovativo.status = 'rejeitado';
        comprovativo.observacoes_admin = observacoes_admin.trim();
        comprovativo.data_analise = new Date();
        comprovativo.admin_responsavel = req.usuario.id;
        await comprovativo.save();

        res.json({
            sucesso: true,
            mensagem: 'Comprovativo rejeitado.',
            comprovativo: {
                id: comprovativo._id,
                status: comprovativo.status,
                data_analise: comprovativo.data_analise,
                observacoes_admin: comprovativo.observacoes_admin
            }
        });

    } catch (error) {
        console.error('Erro ao rejeitar comprovativo:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao rejeitar comprovativo.'
        });
    }
});

// ==============================================================
// 6. ADMIN: EXCLUIR COMPROVATIVO
// ==============================================================
router.delete('/:id', verificarToken, async (req, res) => {
    if (req.usuario.role !== 'admin' && req.usuario.role !== 'SuperAdmin') {
        return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado.' });
    }

    try {
        const { id } = req.params;
        const comprovativo = await Comprovativo.findById(id);

        if (!comprovativo) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Comprovativo não encontrado.'
            });
        }

        await Comprovativo.findByIdAndDelete(id);

        res.json({
            sucesso: true,
            mensagem: 'Comprovativo removido com sucesso.'
        });

    } catch (error) {
        console.error('Erro ao remover comprovativo:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao remover comprovativo.'
        });
    }
});

module.exports = router;
