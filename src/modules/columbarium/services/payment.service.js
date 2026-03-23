const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const Payment = require('../models/payment.model');
const Audit = require('../../audit/models/audit.model');
const AmortSchedule = require('../models/amortSchedule.model');
const PaymentScheduleLink = require('../models/paymentScheduleLink.model');
const { errors } = require('../../../middlewares/errorHandler');
const { toDecimal, toNumber } = require('../../../utils/decimal');
const { updateOverdueEntries, calculatePaymentDistribution } = require('./amortization.service');
const { nowUTC } = require('../../../utils/dateHelpers');

/**
 * Registra un pago y distribuye el monto entre las cuotas pendientes.
 * Operación atómica: actualiza Sale, AmortSchedule y PaymentScheduleLink.
 * @param {string} saleId
 * @param {Object} data     - { amount, method, notes, paymentMode, specificPaymentNumber }
 * @param {Object} userCtx  - { id, username, role, ip, userAgent }
 * @returns {{ payment, schedule }}
 */
async function registerPayment(saleId, { amount, method, notes, paymentMode, specificPaymentNumber }, userCtx) {
    await updateOverdueEntries(saleId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Cargar y validar venta
        const sale = await Sale.findById(saleId).populate('niche').session(session);
        if (!sale) throw errors.notFound('Venta');
        if (sale.status === 'cancelled') throw errors.badRequest('La venta está cancelada');
        if (sale.status === 'paid') throw errors.badRequest('La venta ya está liquidada');

        // 2. Cargar cuotas pendientes
        const pendingEntries = await AmortSchedule.find({
            sale: saleId,
            status: { $in: ['pending', 'partial', 'overdue'] }
        }).sort({ number: 1 }).session(session);

        // 3. Validar monto
        const amountNumber = toNumber(amount);
        if (amountNumber <= 0) throw errors.badRequest('El monto debe ser mayor a 0');

        // 4. Calcular distribución entre cuotas
        const distribution = calculatePaymentDistribution(
            pendingEntries,
            amountNumber,
            paymentMode,
            specificPaymentNumber
        );
        if (!distribution || distribution.length === 0) {
            throw errors.badRequest('No hay cuotas pendientes para aplicar este monto');
        }

        // 5. Calcular nuevos balances de la venta
        const balanceBefore = toNumber(sale.balance);
        const balanceAfter = Math.max(0, balanceBefore - amountNumber);

        // 6. Crear documento Payment
        const newPayment = new Payment({
            sale: saleId,
            customer: sale.customer,
            niche: sale.niche._id,
            registeredBy: userCtx.id,
            receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            amount: toDecimal(amountNumber),
            balanceBefore: toDecimal(balanceBefore),
            balanceAfter: toDecimal(balanceAfter),
            concept: 'monthly_payment',
            method: method || 'cash',
            paymentDate: nowUTC(),
            notes: notes || '',
            status: 'completed'
        });
        await newPayment.save({ session });

        // 7. Actualizar cada cuota en AmortSchedule con bulkWrite
        const now = nowUTC();
        const bulkOps = distribution.map(entry => {
            const originalEntry = pendingEntries.find(e => e._id.equals(entry.amortEntryId));
            const newAmountPaid = toNumber(originalEntry.amountPaid) + entry.appliedAmount;
            const isPaidLate = entry.remainingAfter <= 0
                && originalEntry.status === 'overdue'
                && originalEntry.dueDate < now;
            const newStatus = entry.remainingAfter <= 0
                ? (isPaidLate ? 'paid_late' : 'paid')
                : entry.appliedAmount > 0 ? 'partial' : 'pending';

            return {
                updateOne: {
                    filter: { _id: entry.amortEntryId },
                    update: {
                        $set: {
                            amountPaid: toDecimal(newAmountPaid),
                            amountRemaining: toDecimal(entry.remainingAfter),
                            status: newStatus
                        }
                    }
                }
            };
        });
        await AmortSchedule.bulkWrite(bulkOps, { session });

        // 8. Crear vínculos PaymentScheduleLink (pivote pago ↔ cuota)
        const links = distribution.map(entry => ({
            payment: newPayment._id,
            amortEntry: entry.amortEntryId,
            appliedAmount: toDecimal(entry.appliedAmount),
            paidOn: newPayment.paymentDate
        }));
        await PaymentScheduleLink.insertMany(links, { session });

        // 9. Actualizar Sale: balance, totalPaid y status
        sale.balance = toDecimal(balanceAfter);
        sale.totalPaid = toDecimal(toNumber(sale.totalPaid) + amountNumber);
        if (balanceAfter <= 0) sale.status = 'paid';
        await sale.save({ session });

        // 10. Auditoría
        await Audit.create([{
            user: userCtx.id,
            username: userCtx.username,
            userRole: userCtx.role,
            action: 'register_payment',
            module: 'payment',
            resourceType: 'Payment',
            resourceId: newPayment._id,
            details: {
                saleId,
                paymentId: newPayment._id,
                amount: amountNumber,
                method: method || 'cash',
                distribution,
                balanceBefore,
                balanceAfter
            },
            status: 'success',
            ip: userCtx.ip,
            userAgent: userCtx.userAgent
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Leer schedule actualizado fuera de la sesión para la respuesta
        const schedule = await AmortSchedule.find({ sale: saleId }).sort({ number: 1 });

        return { payment: newPayment, schedule };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

module.exports = { registerPayment };
