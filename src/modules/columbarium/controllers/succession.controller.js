const Niche = require('../models/niche.model');
const Succession = require('../models/succession.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const { registerSuccession, manualTransfer } = require('../services/succession.service');
const { buildUserContext } = require('../../../utils/requestHelpers');

const successionController = {

    /**
     * REGISTRAR FALLECIMIENTO Y SUCESIÓN
     * POST /api/succession/register
     */
    registerSuccession: asyncHandler(async (req, res) => {
        const { nicheId, deceasedDate, notes, deceasedId, reason } = req.body;

        if (!nicheId) throw errors.badRequest('Niche ID es requerido');

        const { niche, previousOwner, newOwner, nextBeneficiary, remaining } = await registerSuccession(
            { nicheId, deceasedDate, notes, deceasedId, reason },
            buildUserContext(req)
        );

        res.status(200).json({
            success: true,
            message: 'Sucesión registrada exitosamente',
            data: {
                niche: { id: niche._id, code: niche.code, displayNumber: niche.displayNumber },
                previousOwner: { id: previousOwner._id, name: `${previousOwner.firstName} ${previousOwner.lastName}` },
                newOwner: {
                    id: newOwner._id,
                    name: `${newOwner.firstName} ${newOwner.lastName}`,
                    phone: newOwner.phone,
                    email: newOwner.email,
                    isNewCustomer: newOwner.createdBySuccession === true
                },
                succession: {
                    date: deceasedDate || new Date(),
                    beneficiary: {
                        name: nextBeneficiary.name,
                        relationship: nextBeneficiary.relationship,
                        order: nextBeneficiary.order
                    },
                    remainingBeneficiaries: remaining.length
                }
            }
        });
    }),

    /**
     * OBTENER HISTORIAL DE TITULARIDAD DE UN NICHO
     * GET /api/succession/niche/:nicheId/history
     */
    getNicheSuccessionHistory: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;

        const niche = await Niche
            .findById(nicheId)
            .populate('currentOwner', 'firstName lastName phone email active')
            .populate('ownershipHistory.owner', 'firstName lastName phone email')
            .populate('ownershipHistory.registeredBy', 'fullName username')
            .lean();

        if (!niche) {
            return res.status(404).json({ success: false, message: 'Nicho no encontrado' });
        }

        const history = (niche.ownershipHistory || [])
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        return res.json({
            success: true,
            data: {
                niche: { _id: niche._id, code: niche.code, displayNumber: niche.displayNumber },
                currentOwner: niche.currentOwner || null,
                history
            }
        });
    }),

    /**
     * OBTENER HISTORIAL DE SUCESIONES DE UN CLIENTE
     * GET /api/succession/customer/:customerId/history
     */
    getCustomerSuccessionHistory: asyncHandler(async (req, res) => {
        const { customerId } = req.params;

        const history = await Succession
            .find({ $or: [{ previousOwner: customerId }, { newOwner: customerId }] })
            .populate('niche', 'code section module')
            .populate('previousOwner', 'firstName lastName')
            .populate('newOwner', 'firstName lastName')
            .populate('registeredBy', 'fullName username')
            .sort({ transferDate: -1 });

        res.status(200).json({ customerId, total: history.length, history });
    }),

    /**
     * TRANSFERENCIA MANUAL DE TITULARIDAD
     * POST /api/succession/transfer
     */
    manualTransfer: asyncHandler(async (req, res) => {
        const { nicheId, newOwnerId, reason, notes } = req.body;

        if (!nicheId || !newOwnerId) {
            throw errors.badRequest('Niche ID y New Owner ID son requeridos');
        }

        const { niche, previousOwner, newOwner } = await manualTransfer(
            { nicheId, newOwnerId, reason, notes },
            buildUserContext(req)
        );

        res.status(200).json({
            success: true,
            message: 'Transferencia completada',
            data: {
                niche: { code: niche.code, displayNumber: niche.displayNumber },
                previousOwner: { name: `${previousOwner.firstName} ${previousOwner.lastName}` },
                newOwner: { name: `${newOwner.firstName} ${newOwner.lastName}` }
            }
        });
    })
};

module.exports = successionController;
