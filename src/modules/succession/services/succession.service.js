/**
 * Servicio de Sucesión
 * Lógica de negocio para sucesión y transferencia de titularidad
 */

const mongoose = require('mongoose');
const Niche = require('../../niche/models/niche.model');
const Customer = require('../../customer/models/customer.model');
const Sale = require('../../sale/models/sale.model');
const Beneficiary = require('../../beneficiary/models/beneficiary.model');
const Deceased = require('../../niche/models/deceased.model');
const Succession = require('../models/succession.model');
const { createAuditLog } = require('../../../utils/audit-logger');
const { errors } = require('../../../middlewares/errorHandler');

const successionService = {
    /**
     * Registrar sucesión por fallecimiento
     */
    async registerSuccession({ customerId, nicheId, deceasedDate, notes, user, req }) {
        if (!customerId || !nicheId) {
            throw errors.badRequest('Customer ID y Niche ID son requeridos');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Buscar cliente y nicho
            const customer = await Customer.findById(customerId).session(session);
            const niche = await Niche.findById(nicheId).populate('currentOwner').session(session);

            if (!customer) throw errors.notFound('Cliente');
            if (!niche) throw errors.notFound('Nicho');

            // 2. Verificar propiedad
            if (niche.currentOwner._id.toString() !== customerId) {
                throw errors.badRequest('El cliente no es el propietario actual del nicho');
            }

            // 3. Obtener próximo beneficiario activo (colección independiente, ligada al nicho)
            const nextBeneficiary = await Beneficiary.findOne({
                niche: nicheId,
                isActive: true,
                isDeceased: false
            }).sort({ order: 1 }).session(session);

            if (!nextBeneficiary) {
                throw errors.badRequest(
                    'No hay beneficiarios activos registrados para este nicho. Actualice los beneficiarios del nicho antes de registrar la sucesión.'
                );
            }

            // 4. Resolver identidad del Customer para el beneficiario
            let newOwner = null;
            let isNewCustomer = false;

            // 4a. Si el beneficiario ya tiene linkedCustomer, usarlo
            if (nextBeneficiary.linkedCustomer) {
                newOwner = await Customer.findById(nextBeneficiary.linkedCustomer).session(session);
                if (newOwner && newOwner.status !== 'active') {
                    newOwner.status = 'active';
                    await newOwner.save({ session });
                }
            }

            // 4b. Si no, buscar por teléfono (más confiable que nombre+teléfono con regex)
            if (!newOwner && nextBeneficiary.phone) {
                newOwner = await Customer.findOne({
                    phone: nextBeneficiary.phone,
                    status: 'active'
                }).session(session);
            }

            // 4c. Si no existe, crear nuevo Customer
            if (!newOwner) {
                const names = nextBeneficiary.name.trim().split(' ');
                const firstName = names[0];
                const lastName = names.slice(1).join(' ') || '';

                const newCustomerDoc = new Customer({
                    firstName,
                    lastName,
                    phone: nextBeneficiary.phone || '0000000000',
                    email: nextBeneficiary.email || undefined,
                    beneficiaries: [],
                    status: 'active'
                });
                newOwner = await newCustomerDoc.save({ session, validateBeforeSave: false });
                isNewCustomer = true;
            }

            // 5. Crear registro Deceased para el titular fallecido
            const actualDeceasedDate = deceasedDate ? new Date(deceasedDate) : new Date();
            const deceasedRecord = await Deceased.create([{
                niche: nicheId,
                fullName: `${customer.firstName} ${customer.lastName}`,
                dateOfDeath: actualDeceasedDate,
                relationshipToOwner: 'titular',
                wasCustomer: customer._id,
                causeOfSuccession: true,
            }], { session });

            // 5b. Agregar difunto a los ocupantes del nicho
            niche.occupants.push(deceasedRecord[0]._id);

            // 6. Transferir titularidad del nicho
            await niche.transferOwnership(
                newOwner._id,
                'succession',
                `Sucesión por fallecimiento de ${customer.firstName} ${customer.lastName}. ${notes || ''}`.trim(),
                user?.id,
                { session }
            );

            // 7. Actualizar venta (preservar originalCustomer)
            const sale = await Sale.findOne({
                niche: nicheId,
                status: { $in: ['active', 'overdue', 'paid'] }
            }).session(session);

            if (sale) {
                if (!sale.originalCustomer) {
                    sale.originalCustomer = sale.customer;
                }
                sale.currentCustomer = newOwner._id;
                sale.customer = newOwner._id;
                sale.successionHistory.push({
                    date: actualDeceasedDate,
                    fromCustomer: customer._id,
                    toCustomer: newOwner._id,
                    reason: 'succession',
                    registeredBy: user?.id
                });
                sale.notes = (sale.notes || '') + `\nSucesión: ${actualDeceasedDate.toLocaleDateString()}`;
                await sale.save({ session });
            }

            // 8. Marcar beneficiario que heredó: transición de rol explícita
            nextBeneficiary.isActive = false;
            nextBeneficiary.becameOwnerAt = new Date();
            nextBeneficiary.linkedCustomer = newOwner._id;
            nextBeneficiary.inactivationReason = 'inherited';
            await nextBeneficiary.save({ session });

            // 9. Re-asignar beneficiarios restantes al nuevo dueño
            await Beneficiary.updateMany(
                { niche: nicheId, isActive: true, _id: { $ne: nextBeneficiary._id } },
                { designatedBy: newOwner._id },
                { session }
            );

            // 10. Crear registro Succession
            const successionRecord = await Succession.create([{
                niche: nicheId,
                previousCustomer: customer._id,
                newCustomer: newOwner._id,
                beneficiary: nextBeneficiary._id,
                sale: sale?._id,
                deceasedDate: actualDeceasedDate,
                deceasedRecord: deceasedRecord[0]._id,
                type: 'succession',
                registeredBy: user?.id,
                reason: 'Fallecimiento del titular',
                notes: notes || ''
            }], { session });

            // 11. Marcar Customer anterior como FALLECIDO (no solo inactivo)
            customer.status = 'deceased';
            customer.deceasedDate = actualDeceasedDate;
            customer.deceasedRecordId = deceasedRecord[0]._id;
            await customer.save({ session });

            // 12. Auditoría
            await createAuditLog({
                user,
                action: 'register_succession',
                module: 'niche',
                resourceType: 'Niche',
                resourceId: nicheId,
                details: {
                    successionId: successionRecord[0]._id,
                    previousOwner: { id: customerId, name: `${customer.firstName} ${customer.lastName}` },
                    newOwner: { id: newOwner._id, name: `${newOwner.firstName} ${newOwner.lastName}`, wasCreated: isNewCustomer },
                    deceasedRecordId: deceasedRecord[0]._id,
                    beneficiaryId: nextBeneficiary._id,
                    beneficiaryName: nextBeneficiary.name,
                    reason: 'succession',
                    deceasedDate: actualDeceasedDate,
                    nicheCode: niche.code
                },
                req,
                session
            });

            await session.commitTransaction();
            session.endSession();

            return {
                succession: { id: successionRecord[0]._id, date: actualDeceasedDate },
                previousOwner: { id: customer._id, name: `${customer.firstName} ${customer.lastName}` },
                newOwner: { id: newOwner._id, name: `${newOwner.firstName} ${newOwner.lastName}`, phone: newOwner.phone, email: newOwner.email, isNewCustomer },
                niche: { id: niche._id, code: niche.code, displayNumber: niche.displayNumber },
                beneficiary: { id: nextBeneficiary._id, name: nextBeneficiary.name, relationship: nextBeneficiary.relationship, order: nextBeneficiary.order },
                deceased: { id: deceasedRecord[0]._id, fullName: deceasedRecord[0].fullName }
            };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    /**
     * Transferencia manual de titularidad
     */
    async manualTransfer({ nicheId, newOwnerId, reason, notes, user, req }) {
        if (!nicheId || !newOwnerId) {
            throw errors.badRequest('Niche ID y New Owner ID son requeridos');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const niche = await Niche.findById(nicheId).populate('currentOwner').session(session);
            const newOwner = await Customer.findById(newOwnerId).session(session);

            if (!niche) throw errors.notFound('Nicho');
            if (!newOwner) throw errors.notFound('Nuevo propietario');
            if (newOwner.status !== 'active') throw errors.badRequest('El nuevo propietario está inactivo');

            const previousOwner = niche.currentOwner;

            await niche.transferOwnership(
                newOwnerId,
                reason || 'transfer',
                notes || 'Transferencia manual',
                user?.id,
                { session }
            );

            const sale = await Sale.findOne({
                niche: nicheId,
                status: { $in: ['active', 'overdue', 'paid'] }
            }).session(session);

            if (sale) {
                if (!sale.originalCustomer) {
                    sale.originalCustomer = sale.customer;
                }
                sale.currentCustomer = newOwnerId;
                sale.customer = newOwnerId;
                sale.successionHistory.push({
                    date: new Date(),
                    fromCustomer: previousOwner._id,
                    toCustomer: newOwnerId,
                    reason: reason || 'transfer',
                    registeredBy: user?.id
                });
                sale.notes = (sale.notes || '') + `\nTransferencia: ${new Date().toLocaleDateString()}`;
                await sale.save({ session });
            }

            await Beneficiary.updateMany(
                { niche: nicheId, isActive: true },
                { designatedBy: newOwnerId },
                { session }
            );

            const successionRecord = await Succession.create([{
                niche: nicheId,
                previousCustomer: previousOwner._id,
                newCustomer: newOwnerId,
                sale: sale?._id,
                type: 'transfer',
                registeredBy: user?.id,
                reason: reason || 'Transferencia manual',
                notes: notes || ''
            }], { session });

            await createAuditLog({
                user,
                action: 'manual_transfer',
                module: 'niche',
                resourceType: 'Niche',
                resourceId: nicheId,
                details: {
                    successionId: successionRecord[0]._id,
                    previousOwner: { id: previousOwner._id, name: `${previousOwner.firstName} ${previousOwner.lastName}` },
                    newOwner: { id: newOwner._id, name: `${newOwner.firstName} ${newOwner.lastName}` },
                    reason: reason || 'transfer',
                    nicheCode: niche.code
                },
                req,
                session
            });

            await session.commitTransaction();
            session.endSession();

            return {
                succession: { id: successionRecord[0]._id },
                niche: { code: niche.code, displayNumber: niche.displayNumber },
                previousOwner: { name: `${previousOwner.firstName} ${previousOwner.lastName}` },
                newOwner: { name: `${newOwner.firstName} ${newOwner.lastName}` }
            };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
};

module.exports = successionService;
