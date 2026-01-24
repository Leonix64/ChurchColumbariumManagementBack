const Sale = require('../models/sale.model');
const Niche = require('../models/niche.model');
const Payment = require('../models/payment.model');
const Customer = require('../models/customer.model');
const Refund = require('../models/refund.model');
const Audit = require('../../audit/models/audit.model');

const mongoose = require('mongoose');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

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

            // 4. Generar tabla de amortizacion
            let amortizationTable = [];
            let currentDate = new Date();

            for (let i = 1; i <= months; i++) {
                let paymentDate = new Date(currentDate);
                paymentDate.setMonth(paymentDate.getMonth() + i);

                amortizationTable.push({
                    number: i,
                    dueDate: paymentDate,
                    amount: monthlyPaymentAmount,
                    amountPaid: 0,
                    amountRemaining: monthlyPaymentAmount,
                    status: 'pending',
                    payments: []
                });
            }

            // 5. Crear venta
            const newSale = new Sale({
                niche: nicheId,
                customer: customerId,
                user: req.user?.id,
                folio: `VENTA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                totalAmount,
                downPayment,
                balance,
                totalPaid: downPayment,
                monthsToPay: months,
                amortizationTable,
                status: 'active'
            });

            await newSale.save({ session });

            // 6. Registrar pago inicial (enganche)
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

            // 7. Actualizar nicho
            niche.status = 'sold';
            niche.currentOwner = customerId;
            await niche.save({ session });

            // 8. Crear log de auditoría
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

            // 9. Commit
            await session.commitTransaction();
            session.endSession();

            res.status(201).json({
                success: true,
                message: 'Venta registrada exitosamente',
                data: {
                    sale: newSale,
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
            // 1. Buscar venta
            const sale = await Sale.findById(id).session(session);
            if (!sale) {
                throw errors.notFound('Venta');
            }
            if (sale.status !== 'active' && sale.status !== 'overdue') {
                throw errors.badRequest(`La venta no está activa (estado: ${sale.status})`);
            }

            // 2. Validar monto
            if (!amount || amount <= 0) {
                throw errors.badRequest('El monto debe ser mayor a 0');
            }

            // 3. Guardar balance actual
            const balanceBefore = sale.balance;

            // 4. Calcular distribucion del pago
            const distribution = saleController.calculatePaymentDistribution(
                sale.amortizationTable,
                amount,
                paymentMode,
                specificPaymentNumber
            );

            if (distribution.length === 0) {
                throw errors.badRequest('No hay pagos pendientes para aplicar este monto');
            }

            // 5. Crear registro de pago
            const newPayment = new Payment({
                sale: id,
                customer: sale.customer,
                registeredBy: req.user?.id,
                receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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

            // 6. Aplicar pago a la venta
            sale.applyPayment(newPayment._id, amount, distribution);
            await sale.save({ session });

            // 7. Crear log de auditoria
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
                    amount,
                    method,
                    appliedTo: distribution,
                    balanceBefore,
                    balanceAfter: sale.balance
                },
                status: 'success',
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            // 8. Commit
            await session.commitTransaction();
            session.endSession();

            res.status(201).json({
                success: true,
                message: 'Pago registrado exitosamente',
                data: {
                    payment: newPayment,
                    sale: sale,
                    distribution: distribution
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
     */
    calculatePaymentDistribution(amortizationTable, totalAmount, mode, specificNumber) {
        const distribution = [];
        let remainingAmount = totalAmount;

        // Ordenar pagos por número
        const sortedPayments = amortizationTable
            .slice()
            .sort((a, b) => a.number - b.number);

        if (mode === 'specific' && specificNumber) {
            // MODO ESPECÍFICO: Aplicar a un pago en particular
            const targetPayment = sortedPayments.find(p => p.number === specificNumber);

            if (!targetPayment || targetPayment.status === 'paid') {
                return distribution;
            }

            const toApply = Math.min(remainingAmount, targetPayment.amountRemaining);

            distribution.push({
                paymentNumber: targetPayment.number,
                appliedAmount: toApply,
                remainingBefore: targetPayment.amountRemaining,
                remainingAfter: targetPayment.amountRemaining - toApply
            });

            return distribution;
        }

        // MODO LIBRE: Distribuir automaticamente
        for (const payment of sortedPayments) {
            if (remainingAmount <= 0) break;
            if (payment.status === 'paid') continue;

            const toApply = Math.min(remainingAmount, payment.amountRemaining);

            distribution.push({
                paymentNumber: payment.number,
                appliedAmount: toApply,
                remainingBefore: payment.amountRemaining,
                remainingAfter: payment.amountRemaining - toApply
            });

            remainingAmount -= toApply;
        }

        return distribution;
    },

    /**
     * OBTENER VENTA POR ID (con populate mejorado)
     * GET /api/sales/:id
     */
    getSaleById: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const sale = await Sale.findById(id)
            .populate('customer', 'firstName lastName phone email address')
            .populate('niche', 'code displayNumber module section type price')
            .populate('user', 'username fullName')
            .populate({
                path: 'amortizationTable.payments.paymentId',
                model: 'Payment',
                select: 'receiptNumber amount method notes paymentDate'
            });

        if (!sale) {
            throw errors.notFound('Venta');
        }

        // Actualizar pagos vencidos
        sale.updateOverduePayments();
        await sale.save();

        res.status(200).json({
            success: true,
            data: sale
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

        const sales = await Sale.find(filter)
            .populate('customer', 'firstName lastName phone email')
            .populate('niche', 'code displayNumber module section type')
            .populate('user', 'username fullName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: sales.length,
            data: sales
        });
    }),

    /**
     * CANCELAR VENTA
     * POST /api/sales/:id/cancel
     */
    cancelSale: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason, refundAmount, refundMethod, refundNotes } = req.body;

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

            // 2. Buscar nicho
            const niche = await Niche.findById(sale.niche).session(session);
            if (!niche) {
                throw errors.notFound('Nicho');
            }

            // 3. Cancelar venta
            sale.cancel(req.user?.id, reason, refundAmount || 0, refundMethod || 'cash', refundNotes);
            await sale.save({ session });

            // 4. Liberar nicho
            niche.status = 'available';
            niche.currentOwner = undefined;
            niche.notes = `Venta cancelada: ${sale.folio}. Razon: ${reason}`;
            await niche.save({ session });

            // 5. Registrar reembolso (si aplica)
            let refund = null;
            if (refundAmount && refundAmount > 0) {
                refund = new Refund({
                    sale: sale._id,
                    customer: sale.customer,
                    refundedBy: req.user?.id,
                    receiptNumber: `REFUND-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    amount: refundAmount,
                    method: refundMethod || 'cash',
                    reason: reason || 'Cancelacion de venta',
                    notes: refundNotes || '',
                    refundDate: new Date(),
                    status: 'completed'
                });

                await refund.save({ session });
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
                    reason,
                    refundAmount: refundAmount || 0,
                    refundMethod: refundMethod || 'N/A'
                },
                status: 'success',
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            // 7. Commit
            await session.commitTransaction();
            session.endSession();

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

        res.status(200).json({
            success: true,
            data: {
                total,
                byStatus: statusStats,
                revenue: revenueStats[0] || {
                    totalRevenue: 0,
                    totalPaid: 0,
                    totalBalance: 0
                }
            }
        });
    }),

    /**
     * CREAR VENTA MULTIPLE
     * POST /api/sales/bulk
     */
    createBulkSale: asyncHandler(async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { nicheIds, customerId, totalAmount, downPayment } = req.body;

            if (!nicheIds || !Array.isArray(nicheIds) || nicheIds.length === 0) {
                throw errors.badRequest('Selecciona al menos 1 nicho');
            }

            if (nicheIds.length > 100) {
                throw errors.badRequest('Maximo 100 nichos por venta');
            }

            const customer = await Customer.findById(customerId).session(session);
            if (!customer || !customer.active) {
                throw errors.notFound('Cliente no encontrado o inactivo');
            }

            const niches = await Niche.find({ _id: { $in: nicheIds } }).session(session);

            if (niches.length !== nicheIds.length) {
                throw errors.notFound('Algunos nichos no existen');
            }

            const unavailable = niches.filter(n => n.status !== 'available');
            if (unavailable.length > 0) {
                throw errors.badRequest(
                    `Nichos no disponibles: ${unavailable.map(n => n.code).join(', ')}`
                );
            }

            const balance = totalAmount - downPayment;
            const months = 18;
            const monthlyPaymentAmount = Number((balance / months).toFixed(2));

            let amortizationTable = [];
            let currentDate = new Date();

            for (let i = 1; i <= months; i++) {
                let paymentDate = new Date(currentDate);
                paymentDate.setMonth(paymentDate.getMonth() + i);

                amortizationTable.push({
                    number: i,
                    dueDate: paymentDate,
                    amount: monthlyPaymentAmount,
                    amountPaid: 0,
                    amountRemaining: monthlyPaymentAmount,
                    status: 'pending',
                    payments: []
                });
            }

            const newSale = new Sale({
                niche: nicheIds[0],
                customer: customerId,
                user: req.user?.id,
                folio: `BULK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                totalAmount,
                downPayment,
                balance,
                totalPaid: downPayment,
                monthsToPay: months,
                amortizationTable,
                status: 'active',
                notes: `Venta multiple: ${nicheIds.length} nichos (${niches.map(n => n.code).join(', ')})`
            });

            await newSale.save({ session });

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

            await Niche.updateMany(
                { _id: { $in: nicheIds } },
                {
                    $set: {
                        status: 'sold',
                        currentOwner: customerId,
                        notes: `Venta: ${newSale.folio}`
                    }
                },
                { session }
            );

            await Audit.create([{
                user: req.user?.id,
                username: req.user?.username,
                userRole: req.user?.role,
                action: 'create_bulk_sale',
                module: 'sale',
                resourceType: 'Sale',
                resourceId: newSale._id,
                details: {
                    saleId: newSale._id,
                    folio: newSale.folio,
                    customerId,
                    nicheIds,
                    totalNiches: nicheIds.length,
                    totalAmount,
                    downPayment
                },
                status: 'success',
                ip: req.ip,
                userAgent: req.get('user-agent')
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.status(201).json({
                success: true,
                message: `Venta multiple registrada: ${nicheIds.length} nichos`,
                data: {
                    sale: newSale,
                    payment: initialPayment,
                    niches: niches.map(n => ({
                        code: n.code,
                        displayNumber: n.displayNumber,
                        type: n.type,
                        price: n.price
                    }))
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    })
};

module.exports = saleController;
