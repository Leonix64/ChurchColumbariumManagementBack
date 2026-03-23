const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const Niche = require('../models/niche.model');
const Payment = require('../models/payment.model');
const Customer = require('../models/customer.model');
const Refund = require('../models/refund.model');
const Beneficiary = require('../models/beneficiary.model');
const Audit = require('../../audit/models/audit.model');
const AmortSchedule = require('../models/amortSchedule.model');
const { errors } = require('../../../middlewares/errorHandler');
const { toDecimal, toNumber } = require('../../../utils/decimal');
const { buildSchedule } = require('./amortization.service');
const { AMORTIZATION } = require('../../../config/constants');
const { nowUTC } = require('../../../utils/dateHelpers');

/**
 * Crea una venta nueva con cuotas de amortización y pago inicial de enganche.
 * Operación atómica: falla completo si cualquier paso falla.
 * @param {Object} data     - { nicheId, customerId, totalAmount, downPayment }
 * @param {Object} userCtx  - { id, username, role, ip, userAgent }
 * @returns {{ sale, schedule, payment, niche }}
 */
async function createSale({ nicheId, customerId, totalAmount, downPayment }, userCtx) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Validar cliente
        const customer = await Customer.findById(customerId).session(session);
        if (!customer || !customer.active) {
            throw errors.notFound('Cliente no encontrado o inactivo');
        }

        // 2. Validar nicho
        const niche = await Niche.findById(nicheId).session(session);
        if (!niche) throw errors.notFound('Nicho');
        if (niche.status !== 'available') {
            throw errors.badRequest(`El nicho no está disponible (estado: ${niche.status})`);
        }

        // 3. Cálculos financieros
        const balance = totalAmount - downPayment;
        const months = AMORTIZATION.DEFAULT_MONTHS;
        const saleDate = nowUTC();

        // 4. Generar tabla de amortización con redondeo justo
        const amortEntries = buildSchedule(balance, months, saleDate);

        // 5. Crear venta
        const newSale = new Sale({
            niche: nicheId,
            customer: customerId,
            user: userCtx.id,
            folio: `VENTA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            totalAmount: toDecimal(totalAmount),
            downPayment: toDecimal(downPayment),
            balance: toDecimal(balance),
            totalPaid: toDecimal(downPayment),
            monthsToPay: months,
            status: 'active'
        });
        await newSale.save({ session });

        // 6. Insertar cuotas en AmortSchedule (misma transacción)
        const docsToInsert = amortEntries.map(e => ({
            ...e,
            sale: newSale._id,
            amount: toDecimal(e.amount),
            amountRemaining: toDecimal(e.amountRemaining),
            amountPaid: toDecimal(0)
        }));
        await AmortSchedule.insertMany(docsToInsert, { session });

        // 7. Registrar pago inicial (enganche)
        const initialPayment = new Payment({
            sale: newSale._id,
            customer: customerId,
            registeredBy: userCtx.id,
            receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            amount: downPayment,
            concept: 'down_payment',
            method: 'cash',
            paymentDate: nowUTC(),
            appliedTo: [{
                paymentNumber: 0,
                appliedAmount: downPayment,
                remainingBefore: totalAmount,
                remainingAfter: balance
            }],
            balanceBefore: totalAmount,
            balanceAfter: balance
        });
        await initialPayment.save({ session });

        // 8. Actualizar nicho: status + historial de titularidad
        niche.status = 'sold';
        await niche.transferOwnership(
            customerId,
            'purchase',
            `Venta ${newSale.folio}`,
            userCtx.id,
            { session }
        );

        // 9. Auditoría
        await Audit.create([{
            user: userCtx.id,
            username: userCtx.username,
            userRole: userCtx.role,
            action: 'create_sale',
            module: 'sale',
            resourceType: 'Sale',
            resourceId: newSale._id,
            details: { saleId: newSale._id, folio: newSale.folio, customerId, nicheId, totalAmount, downPayment },
            status: 'success',
            ip: userCtx.ip,
            userAgent: userCtx.userAgent
        }], { session });

        // 10. Leer cuotas dentro de la sesión para la respuesta
        const schedule = await AmortSchedule
            .find({ sale: newSale._id })
            .sort({ number: 1 })
            .session(session);

        await session.commitTransaction();
        session.endSession();

        return { sale: newSale, schedule, payment: initialPayment, niche };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

/**
 * Cancela una venta activa y genera un reembolso si corresponde.
 * Operación atómica: cancela sale, elimina beneficiarios y libera nicho.
 * @param {string} saleId
 * @param {Object} data     - { reason, refundAmount, refundMethod, refundNotes }
 * @param {Object} userCtx  - { id, username, role, ip, userAgent }
 * @returns {{ sale, niche, refund }}
 */
async function cancelSale(saleId, { reason, refundAmount, refundMethod, refundNotes }, userCtx) {
    // Validar y normalizar refundAmount antes de abrir sesión
    let refundAmountValue = 0;
    if (refundAmount !== undefined && refundAmount !== null && refundAmount !== '') {
        refundAmountValue = Number(refundAmount);
        if (isNaN(refundAmountValue)) {
            throw errors.badRequest('El monto de reembolso debe ser un número válido');
        }
        if (refundAmountValue < 0) {
            throw errors.badRequest('El monto de reembolso no puede ser negativo');
        }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Cargar venta
        const sale = await Sale.findById(saleId).session(session);
        if (!sale) throw errors.notFound('Venta');
        if (sale.status === 'cancelled') throw errors.badRequest('La venta ya esta cancelada');

        if (toNumber(refundAmountValue) > toNumber(sale.totalPaid)) {
            throw errors.badRequest(
                `El reembolso ($${refundAmountValue}) no puede exceder el total pagado ($${toNumber(sale.totalPaid)})`
            );
        }

        // 2. Cargar nicho
        const niche = await Niche.findById(sale.niche).session(session);
        if (!niche) throw errors.notFound('Nicho');

        // 3. Cancelar venta
        sale.cancel(
            userCtx.id,
            reason.trim(),
            toDecimal(refundAmountValue),
            refundMethod || 'cash',
            refundNotes?.trim() || ''
        );
        await sale.save({ session });

        // 4. Borrar beneficiarios del nicho
        await Beneficiary.deleteMany({ niche: niche._id }, { session });

        // 5. Cerrar entrada abierta en ownershipHistory y liberar nicho
        const openEntry = niche.ownershipHistory.find(
            h => h.owner?.toString() === niche.currentOwner?.toString() && !h.endDate
        );
        if (openEntry) openEntry.endDate = nowUTC();

        niche.status = 'available';
        niche.currentOwner = undefined;
        niche.notes = `Venta cancelada: ${sale.folio}. Razon: ${reason.trim()}`;
        await niche.save({ session });

        // 6. Registrar reembolso (solo si hay monto)
        let refund = null;
        if (refundAmountValue > 0) {
            refund = new Refund({
                sale: sale._id,
                customer: sale.customer,
                refundedBy: userCtx.id,
                receiptNumber: `REFUND-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                amount: toDecimal(refundAmountValue),
                method: refundMethod || 'cash',
                reason: reason.trim(),
                notes: refundNotes?.trim() || '',
                refundDate: nowUTC(),
                status: 'completed'
            });
            await refund.save({ session });
        }

        // 7. Auditoría
        await Audit.create([{
            user: userCtx.id,
            username: userCtx.username,
            userRole: userCtx.role,
            action: 'cancel_sale',
            module: 'sale',
            resourceType: 'Sale',
            resourceId: sale._id,
            details: {
                saleId: sale._id,
                folio: sale.folio,
                nicheId: niche._id,
                nicheCode: niche.code,
                reason: reason.trim(),
                refundAmount: refundAmountValue,
                refundMethod: refundMethod || 'N/A',
                previousStatus: 'active',
                newStatus: 'cancelled'
            },
            status: 'success',
            ip: userCtx.ip,
            userAgent: userCtx.userAgent
        }], { session });

        await session.commitTransaction();
        session.endSession();

        return { sale, niche, refund };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

module.exports = { createSale, cancelSale };
