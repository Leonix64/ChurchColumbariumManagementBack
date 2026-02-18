const Beneficiary = require('../models/beneficiary.model');
const Customer = require('../../customer/models/customer.model');
const Niche = require('../../niche/models/niche.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const { createAuditLog } = require('../../../utils/audit-logger');

const beneficiaryController = {
    /**
     * OBTENER BENEFICIARIOS DE UN NICHO
     * GET /api/beneficiaries/niche/:nicheId
     */
    getByNiche: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;
        const { active } = req.query;

        const filter = { niche: nicheId };
        if (active !== undefined) {
            filter.isActive = active === 'true';
        }

        const beneficiaries = await Beneficiary.find(filter)
            .populate('designatedBy', 'firstName lastName')
            .sort({ order: 1 });

        res.status(200).json({
            success: true,
            count: beneficiaries.length,
            data: beneficiaries
        });
    }),

    /**
     * OBTENER BENEFICIARIOS DESIGNADOS POR UN CUSTOMER
     * GET /api/beneficiaries/customer/:customerId
     */
    getByCustomer: asyncHandler(async (req, res) => {
        const { customerId } = req.params;

        const beneficiaries = await Beneficiary.find({
            designatedBy: customerId,
            isActive: true
        })
            .populate('niche', 'code displayNumber module section')
            .sort({ order: 1 });

        res.status(200).json({
            success: true,
            count: beneficiaries.length,
            data: beneficiaries
        });
    }),

    /**
     * ACTUALIZAR BENEFICIARIOS DE UN NICHO
     * PUT /api/beneficiaries/niche/:nicheId
     * Reemplaza los beneficiarios activos del nicho
     */
    updateByNiche: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;
        const { beneficiaries, customerId } = req.body;

        if (!beneficiaries || beneficiaries.length < 3) {
            throw errors.badRequest('Se requieren al menos 3 beneficiarios');
        }

        const niche = await Niche.findById(nicheId);
        if (!niche) throw errors.notFound('Nicho');

        const customer = await Customer.findById(customerId);
        if (!customer) throw errors.notFound('Cliente');

        // Desactivar beneficiarios anteriores
        await Beneficiary.updateMany(
            { niche: nicheId, isActive: true },
            { isActive: false, inactivationReason: 'removed' }
        );

        // Crear nuevos beneficiarios
        const newBeneficiaries = beneficiaries.map((b, index) => ({
            name: b.name,
            relationship: b.relationship,
            phone: b.phone,
            email: b.email,
            dateOfBirth: b.dateOfBirth,
            niche: nicheId,
            designatedBy: customerId,
            order: b.order || index + 1,
            isActive: true,
            isDeceased: b.isDeceased || false,
            deceasedDate: b.deceasedDate,
            notes: b.notes
        }));

        const created = await Beneficiary.insertMany(newBeneficiaries);

        await createAuditLog({
            user: req.user,
            action: 'update_beneficiaries',
            module: 'customer',
            resourceType: 'Niche',
            resourceId: nicheId,
            details: {
                nicheCode: niche.code,
                customerId,
                customerName: `${customer.firstName} ${customer.lastName}`,
                beneficiariesCount: created.length
            },
            req
        });

        res.status(200).json({
            success: true,
            message: 'Beneficiarios actualizados',
            count: created.length,
            data: created
        });
    }),

    /**
     * MARCAR BENEFICIARIO COMO FALLECIDO
     * POST /api/beneficiaries/:id/deceased
     */
    markDeceased: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { deceasedDate, notes } = req.body;

        const beneficiary = await Beneficiary.findById(id);
        if (!beneficiary) throw errors.notFound('Beneficiario');

        if (beneficiary.isDeceased) {
            throw errors.badRequest('El beneficiario ya está marcado como fallecido');
        }

        beneficiary.isDeceased = true;
        beneficiary.isActive = false;
        beneficiary.deceasedDate = deceasedDate || new Date();
        beneficiary.inactivationReason = 'deceased';
        if (notes) beneficiary.notes = notes;
        await beneficiary.save();

        await createAuditLog({
            user: req.user,
            action: 'mark_beneficiary_deceased',
            module: 'customer',
            resourceType: 'Beneficiary',
            resourceId: beneficiary._id,
            details: {
                beneficiaryName: beneficiary.name,
                nicheId: beneficiary.niche,
                deceasedDate: beneficiary.deceasedDate
            },
            req
        });

        res.status(200).json({
            success: true,
            message: 'Beneficiario marcado como fallecido',
            data: beneficiary
        });
    }),

    /**
     * OBTENER PRÓXIMO BENEFICIARIO ACTIVO DE UN NICHO
     * GET /api/beneficiaries/niche/:nicheId/next
     */
    getNextForNiche: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;

        const nextBeneficiary = await Beneficiary.findOne({
            niche: nicheId,
            isActive: true,
            isDeceased: false
        }).sort({ order: 1 });

        res.status(200).json({
            success: true,
            data: nextBeneficiary || null,
            message: nextBeneficiary ? undefined : 'No hay beneficiarios activos para este nicho'
        });
    })
};

module.exports = beneficiaryController;
