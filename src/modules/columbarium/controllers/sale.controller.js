const Sale = require('../models/sale.model');
const Niche = require('../models/niche.model');
const Payment = require('../models/payment.model');
const Customer = require('../models/customer.model');
const Refund = require('../models/refund.model');
const Audit = require('../../audit/models/audit.model');
const AmortSchedule = require('../models/amortSchedule.model');
const PaymentScheduleLink = require('../models/paymentScheduleLink.model');

const mongoose = require('mongoose');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const { toDecimal, toNumber } = require('../../../utils/decimal');

const saleController = {
    /**
     * CREAR NUEVA VENTA
     * POST /api/sales
     */
    createSale: asyncHandler(async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { nicheId, customerId, totalAmount, downPayment } = req.body;

            // 1. Validar cliente
            const customer = await Customer.findById(customerId).session(session);
            if (!customer || !customer.active) {
                throw errors.notFound('Cliente no encontrado o inactivo');
            }

            // 2. Validar nicho
            const niche = await Niche.findById(nicheId).session(session);
            if (!niche) {
                throw errors.notFound('Nicho');
            }
            if (niche.status !== 'available') {
                throw errors.badRequest(`El nicho no está disponible (estado: ${niche.status})`);
            }

            // 3. Calculos financieros
            const balance = totalAmount - downPayment;
            const months = 18;
            const monthlyPaymentAmount = Number((balance / months).toFixed(2));

            // 4. Generar documentos de cuotas para AmortSchedule
            const amortDocs = [];
            let currentDate = new Date();

            for (let i = 1; i <= months; i++) {
                // Crear fecha base
                let paymentDate = new Date(currentDate);
                // Agregar meses correctamente
                paymentDate.setMonth(paymentDate.getMonth() + i);

                /**
                 * Si el día del mes resultante es menor al día original,
                 * significa que "retrocedió" (ej: 31 de enero + 1 mes = 28/29 feb)
                 * En ese caso, ajustar al último día del mes
                 */
                const targetMonth = (currentDate.getMonth() + i) % 12;
                if (paymentDate.getMonth() !== targetMonth && paymentDate.getMonth() !== (targetMonth + 1) % 12) {
                    // Retrocedio, ajustar al ultimo dia del mes anterior
                    paymentDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 0);
                }

                amortDocs.push({
                    sale: null, // se asignará después de crear Sale
                    number: i,
                    dueDate: paymentDate,
                    amount: toDecimal(monthlyPaymentAmount),
                    amountPaid: toDecimal(0),
                    amountRemaining: toDecimal(monthlyPaymentAmount),
                    status: 'pending'
                });
            }

            // 5. Crear venta
            const newSale = new Sale({
                niche: nicheId,
                customer: customerId,
                user: req.user?.id,
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
            const docsToInsert = amortDocs.map(doc => ({ ...doc, sale: newSale._id }));
            await AmortSchedule.insertMany(docsToInsert, { session });

            // 7. Registrar pago inicial (enganche)
            const initialPayment = new Payment({
                sale: newSale._id,
                customer: customerId,
                registeredBy: req.user?.id,
                receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                amount: downPayment,
                concept: 'down_payment',
                method: 'cash',
                paymentDate: new Date(),
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

            // 8. Actualizar nicho
            niche.status = 'sold';
            niche.currentOwner = customerId;
            await niche.save({ session });

            // 9. Crear log de auditoría
            await Audit.create([{
                user: req.user?.id,
                username: req.user?.username,
                userRole: req.user?.role,
                action: 'create_sale',
                module: 'sale',
                resourceType: 'Sale',
                resourceId: newSale._id,
                details: {
                    saleId: newSale._id,
                    folio: newSale.folio,
                    customerId,
                    nicheId,
                    totalAmount,
                    downPayment
                },
                status: 'success',
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            // 10. Leer cuotas dentro de la sesión para incluirlas en la respuesta
            const schedule = await AmortSchedule
                .find({ sale: newSale._id })
                .sort({ number: 1 })
                .session(session);

            // 11. Commit
            await session.commitTransaction();
            session.endSession();

            res.status(201).json({
                success: true,
                message: 'Venta registrada exitosamente',
                data: {
                    sale: newSale,
                    schedule,
                    payment: initialPayment,
                    niche: niche
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }),

    /**
     * REGISTRAR PAGO FLEXIBLE (Parcial/Adelantado/Excedente)
     * POST /api/sales/:id/payment
     */
    registerPayment: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { amount, method, notes, paymentMode, specificPaymentNumber } = req.body;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Cargar la venta y validar
            const sale = await Sale.findById(id)
                .populate('niche')
                .session(session);
            if (!sale) {
                throw errors.notFound('Venta');
            }
            if (sale.status === 'cancelled') {
                throw errors.badRequest('La venta está cancelada');
            }
            if (sale.status === 'paid') {
                throw errors.badRequest('La venta ya está liquidada');
            }

            // 2. Cargar cuotas pendientes desde AmortSchedule
            const pendingEntries = await AmortSchedule.find({
                sale: id,
                status: { $in: ['pending', 'partial', 'overdue'] }
            }).sort({ number: 1 }).session(session);

            // 3. Validar monto
            const amountNumber = toNumber(amount);
            if (amountNumber <= 0) {
                throw errors.badRequest('El monto debe ser mayor a 0');
            }

            // 4. Calcular distribución
            const distribution = saleController.calculatePaymentDistribution(
                pendingEntries,
                amountNumber,
                paymentMode,
                specificPaymentNumber
            );
            if (!distribution || distribution.length === 0) {
                throw errors.badRequest('No hay cuotas pendientes para aplicar este monto');
            }

            // 5. Calcular balances
            const balanceBefore = toNumber(sale.balance);
            const balanceAfter = Math.max(0, balanceBefore - amountNumber);

            // 6. Crear el documento Payment
            const newPayment = new Payment({
                sale: id,
                customer: sale.customer,
                niche: sale.niche._id,
                registeredBy: req.user?.id,
                receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                amount: toDecimal(amountNumber),
                balanceBefore: toDecimal(balanceBefore),
                balanceAfter: toDecimal(balanceAfter),
                concept: 'monthly_payment',
                method: method || 'cash',
                paymentDate: new Date(),
                notes: notes || '',
                status: 'completed'
            });
            await newPayment.save({ session });

            // 7. Actualizar cada cuota en AmortSchedule
            const bulkOps = distribution.map(entry => {
                const originalEntry = pendingEntries.find(
                    e => e._id.equals(entry.amortEntryId)
                );
                const newAmountPaid = toNumber(originalEntry.amountPaid) + entry.appliedAmount;
                const newStatus = entry.remainingAfter <= 0
                    ? 'paid'
                    : entry.appliedAmount > 0
                        ? 'partial'
                        : 'pending';

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

            // 8. Crear vínculos PaymentScheduleLink
            const links = distribution.map(entry => ({
                payment: newPayment._id,
                amortEntry: entry.amortEntryId,
                appliedAmount: toDecimal(entry.appliedAmount),
                paidOn: newPayment.paymentDate
            }));
            await PaymentScheduleLink.insertMany(links, { session });

            // 9. Actualizar Sale: balance y totalPaid
            sale.balance = toDecimal(balanceAfter);
            sale.totalPaid = toDecimal(toNumber(sale.totalPaid) + amountNumber);
            if (balanceAfter <= 0) {
                sale.status = 'paid';
            }
            await sale.save({ session });

            // 10. Auditoría
            await Audit.create([{
                user: req.user?.id,
                username: req.user?.username,
                userRole: req.user?.role,
                action: 'register_payment',
                module: 'payment',
                resourceType: 'Payment',
                resourceId: newPayment._id,
                details: {
                    saleId: id,
                    paymentId: newPayment._id,
                    amount: amountNumber,
                    method: method || 'cash',
                    distribution,
                    balanceBefore,
                    balanceAfter
                },
                status: 'success',
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            // 11. Commit
            await session.commitTransaction();
            session.endSession();

            // 12. Leer schedule actualizado fuera de la sesión
            const schedule = await AmortSchedule
                .find({ sale: id })
                .sort({ number: 1 });

            res.status(201).json({
                success: true,
                message: 'Pago registrado exitosamente',
                data: {
                    payment: newPayment,
                    schedule
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }),

    /**
     * CALCULAR DISTRIBUCION DE PAGO
     * Helper para pagos flexibles
     * Recibe documentos de AmortSchedule (con campos Decimal128)
     */
    calculatePaymentDistribution(pendingEntries, totalAmount, mode, specificNumber) {
        const distribution = [];
        let remainingAmount = totalAmount;

        // Ordenar cuotas por número
        const sortedEntries = pendingEntries
            .slice()
            .sort((a, b) => a.number - b.number);

        if (mode === 'specific' && specificNumber) {
            // MODO ESPECÍFICO: Aplicar a una cuota en particular
            const targetEntry = sortedEntries.find(e => e.number === specificNumber);

            if (!targetEntry || targetEntry.status === 'paid') {
                return distribution;
            }

            const remaining = toNumber(targetEntry.amountRemaining);
            const toApply = Math.min(remainingAmount, remaining);

            distribution.push({
                amortEntryId: targetEntry._id,
                number: targetEntry.number,
                appliedAmount: toApply,
                remainingBefore: remaining,
                remainingAfter: remaining - toApply
            });

            return distribution;
        }

        // MODO LIBRE: Distribuir automaticamente
        for (const entry of sortedEntries) {
            if (remainingAmount <= 0) break;
            if (entry.status === 'paid') continue;

            const remaining = toNumber(entry.amountRemaining);
            const toApply = Math.min(remainingAmount, remaining);

            distribution.push({
                amortEntryId: entry._id,
                number: entry.number,
                appliedAmount: toApply,
                remainingBefore: remaining,
                remainingAfter: remaining - toApply
            });

            remainingAmount -= toApply;
        }

        return distribution;
    },

    /**
     * OBTENER VENTA POR ID (con schedule de AmortSchedule)
     * GET /api/sales/:id
     */
    getSaleById: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const [sale, schedule] = await Promise.all([
            Sale.findById(id)
                .populate('customer', 'firstName lastName phone email address')
                .populate('niche', 'code displayNumber module section type price')
                .populate('user', 'username fullName'),
            AmortSchedule
                .find({ sale: id })
                .sort({ number: 1 })
        ]);

        if (!sale) {
            throw errors.notFound('Venta');
        }

        res.status(200).json({
            success: true,
            data: {
                ...sale.toObject(),
                schedule
            }
        });
    }),

    /**
     * LISTAR TODAS LAS VENTAS
     * GET /api/sales
     */
    getAllSales: asyncHandler(async (req, res) => {
        const { status, customerId } = req.query;
        let filter = {};

        if (status) filter.status = status;
        if (customerId) filter.customer = customerId;

        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip  = (page - 1) * limit;

        const [sales, total] = await Promise.all([
            Sale.find(filter)
                .populate('customer', 'firstName lastName phone')
                .populate('niche', 'code section module')
                .populate('user', 'fullName username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Sale.countDocuments(filter)
        ]);

        res.status(200).json({
            data: sales,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    }),

    /**
     * CANCELAR VENTA
     * POST /api/sales/:id/cancel
     */
    cancelSale: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason, refundAmount, refundMethod, refundNotes } = req.body;

        //console.log('Datos recibidos:', { reason, refundAmount, refundMethod, refundNotes });

        // Validar motivo (OBLIGATORIO)
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'El motivo debe tener al menos 10 caracteres',
                details: [{
                    field: 'reason',
                    message: 'El motivo es requerido y debe tener al menos 10 caracteres'
                }]
            });
        }

        // Validar refund amount (OPCIONAL, pero si viene debe ser válido)
        let refundAmountValue = 0;
        if (refundAmount !== undefined && refundAmount !== null && refundAmount !== '') {
            refundAmountValue = Number(refundAmount);

            if (isNaN(refundAmountValue)) {
                return res.status(400).json({
                    success: false,
                    message: 'El monto de reembolso debe ser un número válido',
                    details: [{
                        field: 'refundAmount',
                        message: 'Debe ser un número válido'
                    }]
                });
            }

            if (refundAmountValue < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El monto de reembolso no puede ser negativo',
                    details: [{
                        field: 'refundAmount',
                        message: 'No puede ser negativo'
                    }]
                });
            }
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Buscar venta
            const sale = await Sale.findById(id).session(session);
            if (!sale) {
                throw errors.notFound('Venta');
            }

            if (sale.status === 'cancelled') {
                throw errors.badRequest('La venta ya esta cancelada');
            }

            // Validar que el refund no exceda lo pagado
            if (toNumber(refundAmountValue) > toNumber(sale.totalPaid)) {
                throw errors.badRequest(
                    `El reembolso ($${refundAmountValue}) no puede exceder el total pagado ($${toNumber(sale.totalPaid)})`
                );
            }

            // 2. Buscar nicho
            const niche = await Niche.findById(sale.niche).session(session);
            if (!niche) {
                throw errors.notFound('Nicho');
            }

            // 3. Cancelar venta
            sale.cancel(
                req.user?.id,
                reason.trim(),
                toDecimal(refundAmountValue),
                refundMethod || 'cash',
                refundNotes?.trim() || ''
            );
            await sale.save({ session });

            //console.log('Venta cancelada:', sale);

            // 4. Liberar nicho
            niche.status = 'available';
            niche.currentOwner = undefined;
            niche.notes = `Venta cancelada: ${sale.folio}. Razon: ${reason.trim()}`;
            await niche.save({ session });

            //console.log('Nicho liberado:', niche);

            // 5. Registrar reembolso (solo si hay monto)
            let refund = null;
            if (refundAmountValue > 0) {
                refund = new Refund({
                    sale: sale._id,
                    customer: sale.customer,
                    refundedBy: req.user?.id,
                    receiptNumber: `REFUND-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    amount: toDecimal(refundAmountValue),
                    method: refundMethod || 'cash',
                    reason: reason.trim(),
                    notes: refundNotes?.trim() || '',
                    refundDate: new Date(),
                    status: 'completed'
                });

                await refund.save({ session });
                //console.log('Reembolso registrado:', refund);
            }

            // 6. Crear log de auditoría
            await Audit.create([{
                user: req.user?.id,
                username: req.user?.username,
                userRole: req.user?.role,
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
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            //console.log('Log de auditoría creado');

            // 7. Commit
            await session.commitTransaction();
            session.endSession();

            //console.log('Transacción completada exitosamente');

            res.status(200).json({
                success: true,
                message: 'Venta cancelada exitosamente',
                data: {
                    sale,
                    niche,
                    refund
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            //console.error('Error en cancelación:', error);
            throw error;
        }
    }),

    /**
     * OBTENER ESTADÍSTICAS
     * GET /api/sales/stats
     */
    getSalesStats: asyncHandler(async (req, res) => {
        const total = await Sale.countDocuments();

        const statusStats = await Sale.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const revenueStats = await Sale.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalPaid: { $sum: '$totalPaid' },
                    totalBalance: { $sum: '$balance' }
                }
            }
        ]);

        const rawRevenue = revenueStats[0];
        const revenue = rawRevenue
            ? {
                totalRevenue: toNumber(rawRevenue.totalRevenue),
                totalPaid:    toNumber(rawRevenue.totalPaid),
                totalBalance: toNumber(rawRevenue.totalBalance)
            }
            : { totalRevenue: 0, totalPaid: 0, totalBalance: 0 };

        res.status(200).json({
            success: true,
            data: {
                total,
                byStatus: statusStats,
                revenue
            }
        });
    })
};

module.exports = saleController;
