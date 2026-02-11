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
    }),

    /**
     * CAMBIAR MATERIAL (1 nicho)
     * PATCH /api/niches/:id/material
     * Body: { type: 'wood' | 'marble, price: 35000 }
     */
    changeMaterial: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { type, price } = req.body;

        if (!type || !['wood', 'marble', 'special'].includes(type)) {
            throw errors.badRequest('Tipo debe ser: wood, marble o special');
        }

        if (!price || price <= 0) {
            throw errors.badRequest('Precio debe ser mayor a 0');
        }

        const niche = await Niche.findById(id);
        if (!niche) {
            throw errors.notFound('Nicho');
        }

        if (niche.status === 'sold') {
            throw errors.badRequest('No se puede cambiar material de nicho vendido');
        }

        const oldType = niche.type;
        const oldPrice = niche.price;

        niche.type = type;
        niche.price = price;
        await niche.save();

        res.json({
            success: true,
            message: 'Material actualizado',
            data: {
                code: niche.code,
                oldType,
                newType: type,
                oldPrice,
                newPrice: price
            }
        });
    }),

    /**
     * CAMBIAR MATERIAL MASIVO
     * POST /api/niches/bulk-material
     * Body: { niches: [id1, id2, ...], type: 'wood' | 'marble, price: 35000 }
     */
    bulkChangeMaterial: asyncHandler(async (req, res) => {
        const { nicheIds, type, price } = req.body;

        if (!nicheIds || !Array.isArray(nicheIds) || nicheIds.length === 0) {
            throw errors.badRequest('Proporciona al menos un ID de nicho');
        }

        if (!type || !['wood', 'marble', 'special'].includes(type)) {
            throw errors.badRequest('Tipo debe ser: wood, marble o special');
        }

        if (!price || price <= 0) {
            throw errors.badRequest('Precio debe ser mayor a 0');
        }

        const soldNiches = await Niche.find({
            _id: { $in: nicheIds },
            status: 'sold'
        });

        if (soldNiches.length > 0) {
            throw errors.badRequest(`No se pueden modificar nichos vendidos: ${soldNiches.map(n => n.code).join(', ')}`);
        }

        const result = await Niche.updateMany(
            { _id: { $in: nicheIds }, status: { $ne: 'sold' } },
            { $set: { type: type, price: price } }
        );

        const updated = await Niche.find({ _id: { $in: nicheIds } })
            .select('code displayNumber type price');

        res.json({
            success: true,
            message: `${result.modifiedCount} nicho(s) actualizados a ${type}`,
            data: updated
        });
    }),

    /**
     * CAMBIAR PRECIO
     * PATCH /api/niches/:id/price
     * Body: { price: 32000 }
     */
    changePrice: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { price } = req.body;

        if (!price || price <= 0) {
            throw errors.badRequest('Precio debe ser mayor a 0');
        }

        const niche = await Niche.findById(id);
        if (!niche) {
            throw errors.notFound('Nicho');
        }

        if (niche.status === 'sold') {
            throw errors.badRequest('No se puede cambiar precio de nicho vendido');
        }

        const oldPrice = niche.price;
        niche.price = price;
        await niche.save();

        res.json({
            success: true,
            message: 'Precio actualizado',
            data: {
                code: niche.code,
                oldPrice,
                newPrice: price
            }
        });
    }),

    /**
     * DESHABILITAR NICHOS
     * POST /api/niches/disable
     * Body: { nicheIds: [id1, id2, ...], reason: 'Motivo }
     */
    disableNiches: asyncHandler(async (req, res) => {
        const { nicheIds, reason } = req.body;

        if (!nicheIds || !Array.isArray(nicheIds) || nicheIds.length === 0) {
            throw errors.badRequest('Proporciona al menos un ID de nicho');
        }

        if (!reason || reason.trim().length === 0) {
            throw errors.badRequest('Proporciona una razón para deshabilitar');
        }

        const niches = await Niche.find({ _id: { $in: nicheIds } });

        if (niches.length !== nicheIds.length) {
            throw errors.notFound('Algunos nichos no existen');
        }

        const soldNiches = niches.filter(n => n.status === 'sold');
        if (soldNiches.length > 0) {
            throw errors.badRequest(`No se pueden deshabilitar nichos vendidos: ${soldNiches.map(n => n.code).join(', ')}`);
        }

        const result = await Niche.updateMany(
            { _id: { $in: nicheIds } },
            {
                $set: {
                    status: 'disabled',
                    disabledReason: reason.trim(),
                    disabledAt: new Date(),
                    disabledBy: req.user.id
                }
            }
        );

        const updated = await Niche.find({ _id: { $in: nicheIds } })
            .select('code displayNumber module section status');

        res.json({
            success: true,
            message: `${result.modifiedCount} nicho(s) deshabilitado(s)`,
            data: updated
        });
    }),

    /**
     * HABILITAR NICHOS
     * POST /api/niches/enable
     * Body: { nicheIds: [id1, id2] }
     */
    enableNiches: asyncHandler(async (req, res) => {
        const { nicheIds } = req.body;

        if (!nicheIds || !Array.isArray(nicheIds) || nicheIds.length === 0) {
            throw errors.badRequest('Proporciona al menos un ID de nicho');
        }

        const result = await Niche.updateMany(
            { _id: { $in: nicheIds }, status: 'disabled' },
            {
                $set: {
                    status: 'available',
                    disabledReason: null,
                    disabledAt: null,
                    disabledBy: null
                }
            }
        );

        const updated = await Niche.find({ _id: { $in: nicheIds } })
            .select('code displayNumber module section status');

        res.json({
            success: true,
            message: `${result.modifiedCount} nicho(s) habilitado(s)`,
            data: updated
        });
    }),

    /**
     * CREAR UN NICHO
     * POST /api/niches
     * Body: { module, section, row, displayNumber, type, price }
     * El campo "number" (posición en la fila) se calcula automáticamente
     */
    createNiche: asyncHandler(async (req, res) => {
        const { module, section, row, displayNumber, type, price } = req.body;

        // Validaciones
        if (!module || !section) {
            throw errors.badRequest('Módulo y sección son requeridos');
        }
        if (!row || row < 1) {
            throw errors.badRequest('La fila debe ser mayor a 0');
        }
        if (!displayNumber || displayNumber < 1) {
            throw errors.badRequest('El número visible debe ser mayor a 0');
        }
        if (!['wood', 'marble', 'special'].includes(type)) {
            throw errors.badRequest('El material debe ser: wood, marble o special');
        }
        if (price === undefined || price === null || price < 0) {
            throw errors.badRequest('El precio es requerido');
        }

        // Verificar que el displayNumber no esté repetido en el mismo módulo-sección
        const duplicateNumber = await Niche.findOne({ module, section, displayNumber });
        if (duplicateNumber) {
            throw errors.conflict(`Ya existe el nicho #${displayNumber} en módulo ${module}, sección ${section}`);
        }

        // Calcular posición automática: cuántos nichos hay en esa fila + 1
        const nichesInRow = await Niche.countDocuments({ module, section, row });
        const number = nichesInRow + 1;

        // Generar código automático
        const code = `${module}-${section}-${row}-${displayNumber}`;

        // Verificar que el código no exista (por si acaso)
        const existingCode = await Niche.findOne({ code });
        if (existingCode) {
            throw errors.conflict(`Ya existe un nicho con el código ${code}`);
        }

        const niche = await Niche.create({
            code,
            displayNumber,
            module,
            section,
            row,
            number,
            type,
            price,
            status: 'available'
        });

        res.status(201).json({
            success: true,
            message: `Nicho #${displayNumber} creado en Módulo ${module}, Sección ${section}, Fila ${row}`,
            data: niche
        });
    }),

    /**
     * VER NICHOS DESHABILITADOS
     * GET /api/niches/disabled
     */
    getDisabledNiches: asyncHandler(async (req, res) => {
        const niches = await Niche.find({ status: 'disabled' })
            .populate('disabledBy', 'username fullName')
            .sort({ disabledAt: -1 });

        res.json({
            success: true,
            count: niches.length,
            data: niches
        });
    }),

    /**
     * BUSCAR NICHOS POR PAGINACION
     * GET /api/niches/search
     * Query params: search, type, limit, page
     */
    searchNiches: asyncHandler(async (req, res) => {
        const { search, type, limit = 20, page = 1 } = req.query;

        let filter = { status: 'available' };

        if (type) filter.type = type;

        if (search) {
            filter.$or = [
                { code: { $regex: search, $options: 'i' } },
                { displayNumber: isNaN(search) ? -1 : parseInt(search) },
                { module: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const niches = await Niche.find(filter)
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ displayNumber: 1 });

        const total = await Niche.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: niches.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: niches
        });
    })
};

module.exports = nicheController;
