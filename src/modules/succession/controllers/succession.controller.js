const Niche = require('../../niche/models/niche.model');
const Succession = require('../models/succession.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const successionService = require('../services/succession.service');

const successionController = {
    /**
     * REGISTRAR FALLECIMIENTO Y SUCESIÓN
     * POST /api/succession/register
     */
    registerSuccession: asyncHandler(async (req, res) => {
        const { customerId, nicheId, deceasedDate, notes } = req.body;

        const result = await successionService.registerSuccession({
            customerId, nicheId, deceasedDate, notes,
            user: req.user, req
        });

        res.status(200).json({
            success: true,
            message: 'Sucesión registrada exitosamente',
            data: result
        });
    }),

    /**
     * OBTENER HISTORIAL DE TITULARIDAD DE UN NICHO
     * GET /api/succession/niche/:id/history
     */
    getOwnershipHistory: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const niche = await Niche.findById(id)
            .populate({
                path: 'ownershipHistory.owner',
                select: 'firstName lastName phone email'
            })
            .populate({
                path: 'ownershipHistory.registeredBy',
                select: 'username fullName'
            })
            .populate('currentOwner', 'firstName lastName phone email');

        if (!niche) {
            throw errors.notFound('Nicho');
        }

        const successions = await Succession.find({ niche: id })
            .populate('previousCustomer', 'firstName lastName phone')
            .populate('newCustomer', 'firstName lastName phone')
            .populate('beneficiary', 'name relationship order')
            .populate('registeredBy', 'username fullName')
            .populate('deceasedRecord', 'fullName dateOfDeath')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                niche: {
                    id: niche._id,
                    code: niche.code,
                    displayNumber: niche.displayNumber,
                    module: niche.module,
                    section: niche.section
                },
                currentOwner: niche.currentOwner,
                ownershipHistory: niche.ownershipHistory.sort((a, b) =>
                    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
                ),
                successions
            }
        });
    }),

    /**
     * TRANSFERENCIA MANUAL DE TITULARIDAD
     * POST /api/succession/transfer
     */
    manualTransfer: asyncHandler(async (req, res) => {
        const { nicheId, newOwnerId, reason, notes } = req.body;

        const result = await successionService.manualTransfer({
            nicheId, newOwnerId, reason, notes,
            user: req.user, req
        });

        res.status(200).json({
            success: true,
            message: 'Transferencia completada',
            data: result
        });
    })
};

module.exports = successionController;
