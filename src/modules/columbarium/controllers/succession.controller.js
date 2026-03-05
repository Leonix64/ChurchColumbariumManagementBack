const mongoose = require('mongoose');
const Niche = require('../models/niche.model');
const Customer = require('../models/customer.model');
const Sale = require('../models/sale.model');
const Succession = require('../models/succession.model');
const Beneficiary = require('../models/beneficiary.model');
const Audit = require('../../audit/models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const successionController = {
    /**
     * REGISTRAR FALLECIMIENTO Y SUCESIÓN
     * POST /api/succession/register
     */
    registerSuccession: asyncHandler(async (req, res) => {
        const { nicheId, deceasedDate, notes, deceasedId, reason } = req.body;
        const userId = req.user?.id;

        if (!nicheId) {
            throw errors.badRequest('Niche ID es requerido');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 8a. Cargar nicho con propietario actual
            const niche = await Niche.findById(nicheId)
                .populate('currentOwner')
                .session(session);

            if (!niche) throw errors.notFound('Nicho');
            if (!niche.currentOwner) throw errors.badRequest('El nicho no tiene titular');
            if (niche.status !== 'sold') throw errors.badRequest('El nicho no tiene una venta activa');

            const previousOwner = niche.currentOwner;

            // 8b. Obtener siguiente beneficiario vivo de la colección Beneficiary
            const nextBeneficiary = await Beneficiary.findOne({
                niche: nicheId,
                isDeceased: false
            }).sort({ order: 1 }).session(session);

            if (!nextBeneficiary) {
                throw errors.badRequest('No hay beneficiarios disponibles para la sucesión');
            }

            // 8c. Buscar o crear el nuevo Customer
            const names = nextBeneficiary.name.trim().split(' ');
            const firstName = names[0];
            const lastName = names.slice(1).join(' ') || '';

            let newOwner = await Customer.findOne({
                firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
                lastName:  { $regex: new RegExp(`^${lastName}$`, 'i') },
                phone: nextBeneficiary.phone || ''
            }).session(session);

            if (!newOwner) {
                const newCustomerDoc = new Customer({
                    firstName,
                    lastName,
                    phone: nextBeneficiary.phone || '0000000000',
                    email: nextBeneficiary.email || undefined,
                    active: true,
                    createdBySuccession: true,
                    successionDate: new Date()
                });
                newOwner = await newCustomerDoc.save({ session });
            }

            // 8d. Actualizar el nicho — nuevo titular
            niche.currentOwner = newOwner._id;
            await niche.save({ session });

            // 8e. Reasignar la venta activa/vencida al nuevo titular
            const sale = await Sale.findOneAndUpdate(
                { niche: nicheId, status: { $in: ['active', 'overdue'] } },
                { customer: newOwner._id },
                { session, new: true }
            );

            // 8f. Reordenar beneficiarios restantes
            // Elimina al beneficiario que heredó
            await Beneficiary.deleteOne({ _id: nextBeneficiary._id }, { session });

            // Reordena los que quedan (solo los vivos)
            const remaining = await Beneficiary.find({
                niche: nicheId,
                isDeceased: false
            }).sort({ order: 1 }).session(session);

            if (remaining.length > 0) {
                const bulkReorder = remaining.map((b, index) => ({
                    updateOne: {
                        filter: { _id: b._id },
                        update: { $set: { order: index + 1 } }
                    }
                }));
                await Beneficiary.bulkWrite(bulkReorder, { session });
            }

            // 8g. Marcar anterior propietario como inactivo
            previousOwner.active = false;
            await previousOwner.save({ session });

            // 8h. Registrar sucesión
            await Succession.create([{
                niche: nicheId,
                sale: sale?._id,
                previousOwner: previousOwner._id,
                newOwner: newOwner._id,
                deceased: deceasedId || undefined,
                registeredBy: userId,
                type: 'death',
                reason: reason || 'Fallecimiento del titular',
                transferDate: new Date(),
                notes: notes || undefined
            }], { session });

            // 8i. Auditoría
            await Audit.create([{
                user: userId,
                username: req.user?.username,
                userRole: req.user?.role,
                action: 'register_succession',
                module: 'niche',
                resourceType: 'Niche',
                resourceId: nicheId,
                details: {
                    previousOwner: {
                        id: previousOwner._id,
                        name: `${previousOwner.firstName} ${previousOwner.lastName}`
                    },
                    newOwner: {
                        id: newOwner._id,
                        name: `${newOwner.firstName} ${newOwner.lastName}`,
                        wasCreated: newOwner.createdBySuccession === true
                    },
                    beneficiary: {
                        name: nextBeneficiary.name,
                        relationship: nextBeneficiary.relationship,
                        order: nextBeneficiary.order
                    },
                    deceasedDate: deceasedDate || new Date(),
                    nicheCode: niche.code
                },
                status: 'success',
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                success: true,
                message: 'Sucesión registrada exitosamente',
                data: {
                    niche: {
                        id: niche._id,
                        code: niche.code,
                        displayNumber: niche.displayNumber
                    },
                    previousOwner: {
                        id: previousOwner._id,
                        name: `${previousOwner.firstName} ${previousOwner.lastName}`
                    },
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

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }),

    /**
     * OBTENER HISTORIAL DE SUCESIONES DE UN NICHO
     * GET /api/succession/niche/:nicheId/history
     */
    getNicheSuccessionHistory: asyncHandler(async (req, res) => {
        const { nicheId } = req.params;

        const history = await Succession
            .find({ niche: nicheId })
            .populate('previousOwner', 'firstName lastName')
            .populate('newOwner', 'firstName lastName')
            .populate('deceased', 'fullName dateOfDeath')
            .populate('registeredBy', 'fullName username')
            .sort({ transferDate: -1 });

        res.status(200).json({
            nicheId,
            total: history.length,
            history
        });
    }),

    /**
     * OBTENER HISTORIAL DE SUCESIONES DE UN CLIENTE
     * GET /api/succession/customer/:customerId/history
     */
    getCustomerSuccessionHistory: asyncHandler(async (req, res) => {
        const { customerId } = req.params;

        const history = await Succession
            .find({
                $or: [
                    { previousOwner: customerId },
                    { newOwner: customerId }
                ]
            })
            .populate('niche', 'code section module')
            .populate('previousOwner', 'firstName lastName')
            .populate('newOwner', 'firstName lastName')
            .populate('registeredBy', 'fullName username')
            .sort({ transferDate: -1 });

        res.status(200).json({
            customerId,
            total: history.length,
            history
        });
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

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const niche = await Niche.findById(nicheId)
                .populate('currentOwner')
                .session(session);
            const newOwner = await Customer.findById(newOwnerId).session(session);

            if (!niche) throw errors.notFound('Nicho');
            if (!newOwner) throw errors.notFound('Nuevo propietario');

            if (!newOwner.active) {
                throw errors.badRequest('El nuevo propietario está inactivo');
            }

            const previousOwner = niche.currentOwner;

            // Transferir titularidad
            await niche.transferOwnership(
                newOwnerId,
                reason || 'transfer',
                notes || 'Transferencia manual',
                req.user?.id,
                { session }
            );

            // Actualizar venta si existe
            const sale = await Sale.findOne({ niche: nicheId }).session(session);
            if (sale) {
                sale.customer = newOwnerId;
                sale.notes = (sale.notes || '') + `\nTransferencia: ${new Date().toLocaleDateString()}`;
                await sale.save({ session });

                // Registrar sucesión
                await Succession.create([{
                    niche: nicheId,
                    sale: sale._id,
                    previousOwner: previousOwner._id,
                    newOwner: newOwnerId,
                    registeredBy: req.user?.id,
                    type: 'manual',
                    reason: reason || 'Transferencia manual',
                    transferDate: new Date(),
                    notes: notes || undefined
                }], { session });
            }

            // Auditoría
            await Audit.create([{
                user: req.user?.id,
                username: req.user?.username,
                userRole: req.user?.role,
                action: 'manual_transfer',
                module: 'niche',
                resourceType: 'Niche',
                resourceId: nicheId,
                details: {
                    previousOwner: {
                        id: previousOwner._id,
                        name: `${previousOwner.firstName} ${previousOwner.lastName}`
                    },
                    newOwner: {
                        id: newOwner._id,
                        name: `${newOwner.firstName} ${newOwner.lastName}`
                    },
                    reason: reason || 'transfer',
                    nicheCode: niche.code
                },
                status: 'success',
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(200).json({
                success: true,
                message: 'Transferencia completada',
                data: {
                    niche: {
                        code: niche.code,
                        displayNumber: niche.displayNumber
                    },
                    previousOwner: {
                        name: `${previousOwner.firstName} ${previousOwner.lastName}`
                    },
                    newOwner: {
                        name: `${newOwner.firstName} ${newOwner.lastName}`
                    }
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    })
};

module.exports = successionController;