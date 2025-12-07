const Niche = require('../models/niche.model');

const nicheController = {

    /**
     * GET /api/niches
     * Obtiene todos los nichos con filtros opcionales.
     * Ejemplo:
     *  /api/niches?status=available&type=wood
     *  /api/niches?module=A&section=A
     */
    getAllNiches: async (req, res) => {
        try {
            const { module, section, status, type } = req.query;
            let filter = {};

            // Construir filtro dinamico
            if (module) filter.module = module;
            if (section) filter.section = section;
            if (status) filter.status = status;
            if (type) filter.type = type;

            // Buscar con orden por numero visible
            const niches = await Niche.find(filter)
                .populate('currentOwner', 'firstName lastName')
                .sort({ displayNumber: 1 });

            res.status(200).json({
                success: true,
                count: niches.length,
                data: niches
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    /**
     * GET /api/niches/code/:code
     * Busca un nicho por su codigo unico.
     * Ejemplo: /api/niches/code/A-A-1-52
     */
    getNicheByCode: async (req, res) => {
        try {
            const { code } = req.params;
            const niche = await Niche.findOne({ code: code })
                .populate('currentOwner')
                .populate('occupants');

            if (!niche) {
                return res.status(404).json({
                    success: false,
                    message: 'Nicho no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                data: niche
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    /**
     * PATCH /api/niches/:id
     * Actualiza estaado de un nicho (para reservas manuales).
     * Ejemplo: { "status": 'reserved', notes: 'Reservado por telefono' }
     */
    updateNicheStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            const niche = await Niche.findByIdAndUpdate(
                id,
                { status, notes },
                { new: true, runValidators: true }
            );

            if (!niche) {
                return res.status(404).json({
                    success: false,
                    message: 'Nicho no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Estado actualizado',
                data: niche
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = nicheController;
