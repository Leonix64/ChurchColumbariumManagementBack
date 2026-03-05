const mongoose = require('mongoose');
const Niche = require('../models/niche.model');
const Customer = require('../models/customer.model');
const Sale = require('../models/sale.model');
const Succession = require('../models/succession.model');
const Audit = require('../../audit/models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const successionController = {
    /**
     * REGISTRAR FALLECIMIENTO Y SUCESIÓN
     * POST /api/succession/register
     */
    registerSuccession: asyncHandler(async (req, res) => {
        const { customerId, nicheId, deceasedDate, notes, deceasedId, reason } = req.body;

        if (!customerId || !nicheId) {
            throw errors.badRequest('Customer ID y Niche ID son requeridos');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Buscar cliente y nicho
            const customer = await Customer.findById(customerId).session(session);
            const niche = await Niche.findById(nicheId)
                .populate('currentOwner')
                .session(session);

            if (!customer) throw errors.notFound('Cliente');
            if (!niche) throw errors.notFound('Nicho');

            // 2. Verificar que el cliente sea el propietario actual
            if (niche.currentOwner._id.toString() !== customerId) {
                throw errors.badRequest('El cliente no es el propietario actual del nicho');
            }

            // 3. Obtener próximo beneficiario vivo
            const nextBeneficiary = customer.getNextBeneficiary();

            if (!nextBeneficiary) {
                throw errors.badRequest(
                    'No hay beneficiarios vivos registrados. Se debe actualizar el registro manualmente.'
                );
            }

            // 4. Buscar o crear cliente para el beneficiario
            const names = nextBeneficiary.name.trim().split(' ');
            const firstName = names[0];
            const lastName = names.slice(1).join(' ') || '';

            let newOwner = await Customer.findOne({
                firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
                lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
                phone: nextBeneficiary.phone || ''
            }).session(session);

            if (!newOwner) {
                // Crear nuevo cliente
                // Los beneficiarios del nuevo titular son los que quedan en la lista
                const remainingBeneficiaries = customer.beneficiaries
                    .filter(b => !b.isDeceased && b._id.toString() !== nextBeneficiary._id.toString())
                    .sort((a, b) => a.order - b.order)
                    .map((b, index) => ({
                        ...b.toObject(),
                        _id: undefined, // Generar nuevos IDs
                        order: index + 1 // Renumerar
                    }));

                // Crear con validateBeforeSave: false porque puede no tener
                // teléfono o suficientes beneficiarios (se actualizará después)
                const newCustomerDoc = new Customer({
                    firstName,
                    lastName,
                    phone: nextBeneficiary.phone || '0000000000',
                    email: nextBeneficiary.email || undefined,
                    beneficiaries: remainingBeneficiaries.length >= 3
                        ? remainingBeneficiaries
                        : [],
                    active: true
                });
                newOwner = await newCustomerDoc.save({ session, validateBeforeSave: false });
            }

            // 5. Transferir titularidad del nicho
            await niche.transferOwnership(
                newOwner._id,
                'succession',
                `Sucesión por fallecimiento de ${customer.firstName} ${customer.lastName}. ${notes || ''}`.trim(),
                req.user?.id,
                { session }
            );

            // 6. Actualizar venta
            const sale = await Sale.findOne({ niche: nicheId }).session(session);
            if (sale) {
                sale.customer = newOwner._id;
                sale.notes = (sale.notes || '') + `\nSucesión: ${new Date().toLocaleDateString()}`;
                await sale.save({ session });

                // Registrar sucesión
                await Succession.create([{
                    niche: nicheId,
                    sale: sale._id,
                    previousOwner: customerId,
                    newOwner: newOwner._id,
                    deceased: deceasedId || undefined,
                    registeredBy: req.user?.id,
                    type: 'death',
                    reason: reason || 'Fallecimiento del titular',
                    transferDate: new Date(),
                    notes: notes || undefined
                }], { session });
            }

            // 7. Marcar al cliente anterior como inactivo (opcional)
            customer.active = false;
            await customer.save({ session });

            // 8. Auditoría
            await Audit.create([{
                user: req.user?.id,
                username: req.user?.username,
                userRole: req.user?.role,
                action: 'register_succession',
                module: 'niche',
                resourceType: 'Niche',
                resourceId: nicheId,
                details: {
                    previousOwner: {
                        id: customerId,
                        name: `${customer.firstName} ${customer.lastName}`
                    },
                    newOwner: {
                        id: newOwner._id,
                        name: `${newOwner.firstName} ${newOwner.lastName}`,
                        wasCreated: !newOwner.createdAt || newOwner.createdAt > new Date(Date.now() - 1000)
                    },
                    reason: 'succession',
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
                    previousOwner: {
                        id: customer._id,
                        name: `${customer.firstName} ${customer.lastName}`
                    },
                    newOwner: {
                        id: newOwner._id,
                        name: `${newOwner.firstName} ${newOwner.lastName}`,
                        phone: newOwner.phone,
                        email: newOwner.email,
                        isNewCustomer: !newOwner.createdAt || newOwner.createdAt > new Date(Date.now() - 1000)
                    },
                    niche: {
                        id: niche._id,
                        code: niche.code,
                        displayNumber: niche.displayNumber
                    },
                    succession: {
                        date: deceasedDate || new Date(),
                        beneficiary: {
                            name: nextBeneficiary.name,
                            relationship: nextBeneficiary.relationship,
                            order: nextBeneficiary.order
                        }
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