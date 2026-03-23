const mongoose = require('mongoose');
const Niche = require('../models/niche.model');
const Customer = require('../models/customer.model');
const Sale = require('../models/sale.model');
const Succession = require('../models/succession.model');
const Beneficiary = require('../models/beneficiary.model');
const Audit = require('../../audit/models/audit.model');
const { errors } = require('../../../middlewares/errorHandler');
const { nowUTC } = require('../../../utils/dateHelpers');
const { AUDIT_STATUS } = require('../../../config/constants');

/**
 * Registra una sucesión por fallecimiento del titular.
 * Busca el siguiente beneficiario vivo, crea Customer si no existe,
 * transfiere titularidad del nicho y reasigna la venta activa.
 * Operación atómica.
 * @param {Object} data     - { nicheId, deceasedDate, notes, deceasedId, reason }
 * @param {Object} userCtx  - { id, username, role, ip, userAgent }
 * @returns {{ niche, previousOwner, newOwner, nextBeneficiary, remaining, sale }}
 */
async function registerSuccession({ nicheId, deceasedDate, notes, deceasedId, reason }, userCtx) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Cargar nicho con propietario actual
        const niche = await Niche.findById(nicheId).populate('currentOwner').session(session);
        if (!niche) throw errors.notFound('Nicho');
        if (!niche.currentOwner) throw errors.badRequest('El nicho no tiene titular');
        if (niche.status !== 'sold') throw errors.badRequest('El nicho no tiene una venta activa');

        const previousOwner = niche.currentOwner;

        // 2. Obtener siguiente beneficiario vivo (menor order)
        const nextBeneficiary = await Beneficiary.findOne({
            niche: nicheId,
            isDeceased: false
        }).sort({ order: 1 }).session(session);

        if (!nextBeneficiary) {
            throw errors.badRequest('No hay beneficiarios disponibles para la sucesión');
        }

        // 3. Buscar o crear el Customer del beneficiario
        const names = nextBeneficiary.name.trim().split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ') || '';

        let newOwner = await Customer.findOne({
            firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
            lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
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
                successionDate: nowUTC()
            });
            newOwner = await newCustomerDoc.save({ session });
        }

        // 4. Transferir titularidad del nicho con historial
        await niche.transferOwnership(
            newOwner._id,
            'succession',
            notes || 'Sucesión por fallecimiento',
            userCtx.id,
            { session }
        );

        // 5. Reasignar venta activa/vencida al nuevo titular
        const sale = await Sale.findOneAndUpdate(
            { niche: nicheId, status: { $in: ['active', 'overdue'] } },
            { customer: newOwner._id },
            { session, new: true }
        );

        // 6. Eliminar beneficiario que heredó y reordenar los restantes
        await Beneficiary.deleteOne({ _id: nextBeneficiary._id }, { session });

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

        // 7. Marcar propietario anterior como inactivo
        previousOwner.active = false;
        await previousOwner.save({ session });

        // 8. Registrar documento de sucesión
        await Succession.create([{
            niche: nicheId,
            sale: sale?._id,
            previousOwner: previousOwner._id,
            newOwner: newOwner._id,
            deceased: deceasedId || undefined,
            registeredBy: userCtx.id,
            type: 'death',
            reason: reason || 'Fallecimiento del titular',
            transferDate: nowUTC(),
            notes: notes || undefined
        }], { session });

        // 9. Auditoría
        await Audit.create([{
            user: userCtx.id,
            username: userCtx.username,
            userRole: userCtx.role,
            action: 'register_succession',
            module: 'niche',
            resourceType: 'Niche',
            resourceId: nicheId,
            details: {
                previousOwner: { id: previousOwner._id, name: `${previousOwner.firstName} ${previousOwner.lastName}` },
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
            status: AUDIT_STATUS.SUCCESS,
            ip: userCtx.ip,
            userAgent: userCtx.userAgent
        }], { session });

        await session.commitTransaction();
        session.endSession();

        return { niche, previousOwner, newOwner, nextBeneficiary, remaining, sale };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

/**
 * Realiza una transferencia manual de titularidad entre dos clientes existentes.
 * Operación atómica.
 * @param {Object} data     - { nicheId, newOwnerId, reason, notes }
 * @param {Object} userCtx  - { id, username, role, ip, userAgent }
 * @returns {{ niche, previousOwner, newOwner }}
 */
async function manualTransfer({ nicheId, newOwnerId, reason, notes }, userCtx) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const niche = await Niche.findById(nicheId).populate('currentOwner').session(session);
        const newOwner = await Customer.findById(newOwnerId).session(session);

        if (!niche) throw errors.notFound('Nicho');
        if (!newOwner) throw errors.notFound('Nuevo propietario');
        if (!newOwner.active) throw errors.badRequest('El nuevo propietario está inactivo');

        const previousOwner = niche.currentOwner;

        await niche.transferOwnership(
            newOwnerId,
            reason || 'transfer',
            notes || 'Transferencia manual',
            userCtx.id,
            { session }
        );

        const sale = await Sale.findOne({ niche: nicheId }).session(session);
        if (sale) {
            sale.customer = newOwnerId;
            sale.notes = (sale.notes || '') + `\nTransferencia: ${nowUTC().toISOString().split('T')[0]}`;
            await sale.save({ session });

            await Succession.create([{
                niche: nicheId,
                sale: sale._id,
                previousOwner: previousOwner._id,
                newOwner: newOwnerId,
                registeredBy: userCtx.id,
                type: 'manual',
                reason: reason || 'Transferencia manual',
                transferDate: nowUTC(),
                notes: notes || undefined
            }], { session });
        }

        await Audit.create([{
            user: userCtx.id,
            username: userCtx.username,
            userRole: userCtx.role,
            action: 'manual_transfer',
            module: 'niche',
            resourceType: 'Niche',
            resourceId: nicheId,
            details: {
                previousOwner: { id: previousOwner._id, name: `${previousOwner.firstName} ${previousOwner.lastName}` },
                newOwner: { id: newOwner._id, name: `${newOwner.firstName} ${newOwner.lastName}` },
                reason: reason || 'transfer',
                nicheCode: niche.code
            },
            status: AUDIT_STATUS.SUCCESS,
            ip: userCtx.ip,
            userAgent: userCtx.userAgent
        }], { session });

        await session.commitTransaction();
        session.endSession();

        return { niche, previousOwner, newOwner };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

module.exports = { registerSuccession, manualTransfer };
