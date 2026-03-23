const mongoose = require('mongoose');
const Beneficiary = require('../models/beneficiary.model');
const Audit = require('../../audit/models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const { nowUTC } = require('../../../utils/dateHelpers');
const { AUDIT_STATUS } = require('../../../config/constants');

const beneficiaryController = {

    /**
     * LISTAR BENEFICIARIOS DE UN NICHO
     * GET /api/beneficiaries/niche/:nicheId
     */
    getByNiche: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;

        const beneficiaries = await Beneficiary.find({ niche: nicheId })
            .sort({ order: 1 });

        res.status(200).json({
            success: true,
            nicheId,
            count: beneficiaries.length,
            data: beneficiaries
        });
    }),

    /**
     * CREAR BENEFICIARIO
     * POST /api/beneficiaries/niche/:nicheId
     */
    create: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;
        const { name, relationship, phone, email, dateOfBirth, order, notes } = req.body;

        const beneficiary = await Beneficiary.create({
            niche: nicheId,
            name,
            relationship,
            phone,
            email,
            dateOfBirth,
            order,
            notes
        });

        await Audit.create({
            user: req.user?.id,
            username: req.user?.username,
            userRole: req.user?.role,
            action: 'create_beneficiary',
            module: 'customer',
            resourceType: 'Beneficiary',
            resourceId: beneficiary._id,
            details: {
                nicheId,
                beneficiaryName: beneficiary.name,
                relationship: beneficiary.relationship,
                order: beneficiary.order
            },
            status: AUDIT_STATUS.SUCCESS,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(201).json({
            success: true,
            message: 'Beneficiario creado exitosamente',
            data: beneficiary
        });
    }),

    /**
     * ACTUALIZAR BENEFICIARIO
     * PUT /api/beneficiaries/:id
     */
    update: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        // No permitir cambiar el nicho al que pertenece
        delete updates.niche;
        delete updates._id;

        const beneficiary = await Beneficiary.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        if (!beneficiary) {
            throw errors.notFound('Beneficiario');
        }

        res.status(200).json({
            success: true,
            message: 'Beneficiario actualizado',
            data: beneficiary
        });
    }),

    /**
     * REEMPLAZAR TODOS LOS BENEFICIARIOS DE UN NICHO (bulk)
     * PUT /api/beneficiaries/niche/:nicheId/bulk
     */
    bulkUpdate: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;
        const { beneficiaries } = req.body;

        if (!beneficiaries || beneficiaries.length < 3) {
            throw errors.badRequest('Se requieren al menos 3 beneficiarios');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            await Beneficiary.deleteMany({ niche: nicheId }, { session });

            const docs = beneficiaries.map((b, index) => ({
                ...b,
                niche: nicheId,
                order: b.order ?? index + 1
            }));

            const created = await Beneficiary.insertMany(docs, { session });

            await Audit.create([{
                user: req.user?.id,
                username: req.user?.username,
                userRole: req.user?.role,
                action: 'bulk_update_beneficiaries',
                module: 'customer',
                resourceType: 'Niche',
                resourceId: nicheId,
                details: {
                    nicheId,
                    count: created.length
                },
                status: AUDIT_STATUS.SUCCESS,
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                success: true,
                message: 'Beneficiarios actualizados',
                count: created.length,
                data: created
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }),

    /**
     * MARCAR BENEFICIARIO COMO FALLECIDO
     * POST /api/beneficiaries/:id/deceased
     */
    markDeceased: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { deceasedDate, notes } = req.body;

        const beneficiary = await Beneficiary.findById(id);

        if (!beneficiary) {
            throw errors.notFound('Beneficiario');
        }

        if (beneficiary.isDeceased) {
            throw errors.badRequest('El beneficiario ya está marcado como fallecido');
        }

        beneficiary.isDeceased = true;
        beneficiary.deceasedDate = deceasedDate || nowUTC();
        if (notes) {
            beneficiary.notes = notes;
        }

        await beneficiary.save();

        await Audit.create({
            user: req.user?.id,
            username: req.user?.username,
            userRole: req.user?.role,
            action: 'mark_beneficiary_deceased',
            module: 'customer',
            resourceType: 'Beneficiary',
            resourceId: beneficiary._id,
            details: {
                nicheId: beneficiary.niche,
                beneficiaryName: beneficiary.name,
                deceasedDate: beneficiary.deceasedDate,
                notes: beneficiary.notes || undefined
            },
            status: AUDIT_STATUS.SUCCESS,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(200).json({
            success: true,
            message: 'Beneficiario marcado como fallecido',
            data: beneficiary
        });
    }),

    /**
     * OBTENER PRÓXIMO BENEFICIARIO VIVO DE UN NICHO
     * GET /api/beneficiaries/niche/:nicheId/next
     */
    getNextBeneficiary: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;

        const next = await Beneficiary.findOne({
            niche: nicheId,
            isDeceased: false
        }).sort({ order: 1 });

        if (!next) {
            return res.status(200).json({
                success: true,
                message: 'No hay beneficiarios vivos disponibles',
                data: null
            });
        }

        res.status(200).json({
            success: true,
            data: next
        });
    })
};

module.exports = beneficiaryController;
