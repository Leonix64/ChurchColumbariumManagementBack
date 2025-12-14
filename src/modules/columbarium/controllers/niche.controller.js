const Niche = require('../models/niche.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const nicheController = {
    /**
     * OBTENER TODOS LOS NICHOS
     * GET /api/niches
     * Query params: module, section, status, type
     */
    getAllNiches: asyncHandler(async (req, res) => {
        const { module, section, status, type } = req.query;
        let filter = {};

        // Construir filtro dinamico
        if (module) filter.module = module.toUpperCase();
        if (section) filter.section = section.toUpperCase();
        if (status) filter.status = status;
        if (type) filter.type = type;

        // Buscar con orden por numero visible
        const niches = await Niche.find(filter)
            .populate('currentOwner', 'firstName lastName phone email')
            .sort({ displayNumber: 1 });

        res.status(200).json({
            success: true,
            count: niches.length,
            data: niches
        });
    }),

    /**
     * BUSCAR NICHO POR CÓDIGO
     * GET /api/niches/code/:code
     */
    getNicheByCode: asyncHandler(async (req, res) => {
        const { code } = req.params;

        const niche = await Niche.findOne({ code: code.toUpperCase() })
            .populate('currentOwner', 'firstName lastName phone email')
            .populate('occupants');

        if (!niche) {
            throw errors.notFound('Nicho');
        }

        res.status(200).json({
            success: true,
            data: niche
        });
    }),

    /**
     * OBTENER NICHO POR ID
     * GET /api/niches/:id
     */
    getNicheById: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const niche = await Niche.findById(id)
            .populate('currentOwner', 'firstName lastName phone email')
            .populate('occupants');

        if (!niche) {
            throw errors.notFound('Nicho');
        }

        res.status(200).json({
            success: true,
            data: niche
        });
    }),

    /**
     * ACTUALIZAR ESTADO DE NICHO
     * PATCH /api/niches/:id
     * Body: { status, notes }
     */
    updateNicheStatus: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status, notes } = req.body;

        // Validar que al menos venga un campo
        if (!status && !notes) {
            throw errors.badRequest('Debe proporcionar al menos status o notes');
        }

        const updates = {};
        if (status) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        const niche = await Niche.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).populate('currentOwner', 'firstName lastName');

        if (!niche) {
            throw errors.notFound('Nicho');
        }

        res.status(200).json({
            success: true,
            message: 'Nicho actualizado',
            data: niche
        });
    }),

    /**
     * OBTENER ESTADISTICAS DE NICHOS
     * GET /api/niches/stats
     */
    getNicheStats: asyncHandler(async (req, res) => {
        // Estadisticas por estado
        const statusStats = await Niche.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Estadisticas por tipo
        const typeStats = await Niche.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);

        // Estadisticas por modulo
        const moduleStats = await Niche.aggregate([
            { $group: { _id: '$module', count: { $sum: 1 } } }
        ]);

        // Total de nichos
        const total = await Niche.countDocuments();

        // Precio promedio
        const priceStats = await Niche.aggregate([
            {
                $group: {
                    _id: null,
                    avgPrice: { $avg: '$price' },
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                total,
                byStatus: statusStats,
                byType: typeStats,
                byModule: moduleStats,
                pricing: priceStats[0] || {
                    avgPrice: 0,
                    minPrice: 0,
                    maxPrice: 0
                }
            }
        });
    }),

    /**
     * BUSCAR NICHOS DISPONIBLES
     * GET /api/niches/available
     * Query params: type, module, section
     */
    getAvailableNiches: asyncHandler(async (req, res) => {
        const { type, module, section } = req.query;
        let filter = { status: 'available' };

        if (type) filter.type = type;
        if (module) filter.module = module.toUpperCase();
        if (section) filter.section = section.toUpperCase();

        const niches = await Niche.find(filter)
            .sort({ displayNumber: 1 });

        res.status(200).json({
            success: true,
            count: niches.length,
            data: niches
        });
    })
};

module.exports = nicheController;
