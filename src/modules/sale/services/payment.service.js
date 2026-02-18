/**
 * Servicio de Pagos
 * Lógica de negocio para registro de pagos mensuales
 */

const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const Payment = require('../models/payment.model');
const amortizationService = require('./amortization.service');
const { generateReceiptNumber } = require('../../../utils/folio-generator');
const { createAuditLog } = require('../../../utils/audit-logger');
const { errors } = require('../../../middlewares/errorHandler');

const paymentService = {
    /**
     * Registrar pago flexible (parcial/adelantado/excedente)
     */
    async registerPayment({ saleId, amount, method, notes, paymentMode, specificPaymentNumber, user, req }) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const sale = await Sale.findById(saleId).session(session);
            if (!sale) throw errors.notFound('Venta');

            if (sale.status !== 'active' && sale.status !== 'overdue') {
                throw errors.badRequest(`La venta no está activa (estado: ${sale.status})`);
            }

            if (!amount || amount <= 0) {
                throw errors.badRequest('El monto debe ser mayor a 0');
            }

            const balanceBefore = sale.balance;

            const distribution = amortizationService.calculatePaymentDistribution(
                sale.amortizationTable,
                amount,
                paymentMode,
                specificPaymentNumber
            );

            if (distribution.length === 0) {
                throw errors.badRequest('No hay pagos pendientes para aplicar este monto');
            }

            const newPayment = new Payment({
                sale: saleId,
                customer: sale.customer,
                registeredBy: user?.id,
                receiptNumber: generateReceiptNumber(),
                amount,
                concept: 'monthly_payment',
                method: method || 'cash',
                paymentDate: new Date(),
                appliedTo: distribution,
                balanceBefore,
                balanceAfter: balanceBefore - amount,
                notes: notes || ''
            });

            await newPayment.save({ session });

            sale.applyPayment(newPayment._id, amount, distribution);
            await sale.save({ session });

            await createAuditLog({
                user,
                action: 'register_payment',
                module: 'payment',
                resourceType: 'Payment',
                resourceId: newPayment._id,
                details: {
                    saleId, paymentId: newPayment._id, amount, method,
                    appliedTo: distribution, balanceBefore, balanceAfter: sale.balance
                },
                req,
                session
            });

            await session.commitTransaction();
            session.endSession();

            return { payment: newPayment, sale, distribution };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
};

module.exports = paymentService;
