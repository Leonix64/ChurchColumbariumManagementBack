const Sale = require('../models/sale.model');
const Niche = require('../models/niche.model');
const Payment = require('../models/payment.model');
const Customer = require('../models/customer.model');
const mongoose = require('mongoose');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const saleController = {
    /**
     * CREAR NUEVA VENTA
     * POST /api/sales
     * Transacción atomica: venta + pago inicial + actualizar nicho
     */
    createSale: asyncHandler(async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { nicheId, customerId, totalAmount, downPayment } = req.body;

            // 1. VALIDAR QUE EXISTA EL CLIENTE
            const customer = await Customer.findById(customerId).session(session);
            if (!customer) {
                throw errors.notFound('Cliente');
            }

            if (!customer.active) {
                throw errors.badRequest('El cliente está desactivado');
            }

            // 2. VALIDAR NICHO DISPONIBLE
            const niche = await Niche.findById(nicheId).session(session);
            if (!niche) {
                throw errors.notFound('Nicho');
            }

            if (niche.status !== 'available') {
                throw errors.badRequest(`El nicho no esta disponible (estado: ${niche.status})`);
            }

            // 3. CALCULOS FINANCIEROS
            const balance = totalAmount - downPayment;
            const months = 18;
            const monthlyPaymentAmount = Number((balance / months).toFixed(2));

            // 4. GENERAR TABLA DE AMORTIZACIÓN (18 pagos mensuales)
            let amortizationTable = [];
            let currentDate = new Date();

            for (let i = 1; i <= months; i++) {
                let paymentDate = new Date(currentDate);
                paymentDate.setMonth(paymentDate.getMonth() + i);

                amortizationTable.push({
                    number: i,
                    dueDate: paymentDate,
                    amount: monthlyPaymentAmount,
                    status: 'pending'
                });
            }

            // 5. CREAR REGISTRO DE VENTA
            const newSale = new Sale({
                niche: nicheId,
                customer: customerId,
                folio: `VENTA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                totalAmount,
                downPayment,
                balance,
                monthsToPay: months,
                amortizationTable,
                status: 'active'
            });

            await newSale.save({ session });

            // 6. REGISTRAR PAGO INICIAL (ENGANCHE)
            const initialPayment = new Payment({
                sale: newSale._id,
                customer: customerId,
                receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                amount: downPayment,
                concept: 'down_payment',
                method: 'cash',
                paymentDate: new Date()
            });

            await initialPayment.save({ session });

            // 7. ACTUALIZAR NICHO (MARCAR COMO VENDIDO)
            niche.status = 'sold';
            niche.currentOwner = customerId;
            await niche.save({ session });

            // 8. CONFIRMAR TRANSACCIÓN (TODO O NADA)
            await session.commitTransaction();
            session.endSession();

            // 9. RESPONDER CON ÉXITO
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
            // ROLLBACK: Si algo falla, se deshace todo
            await session.abortTransaction();
            session.endSession();

            // Re-lanzar el error para que asyncHandler lo maneje
            throw error;
        }
    }),

    /**
     * OBTENER TODAS LAS VENTAS
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
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: sales.length,
            data: sales
        });
    }),

    /**
     * OBTENER VENTA POR ID
     * GET /api/sales/:id
     */
    getSaleById: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const sale = await Sale.findById(id)
            .populate('customer', 'firstName lastName phone email address')
            .populate('niche', 'code displayNumber module section type price');

        if (!sale) {
            throw errors.notFound('Venta');
        }

        res.status(200).json({
            success: true,
            data: sale
        });
    }),

    /**
     * REGISTRAR PAGO MENSUAL
     * POST /api/sales/:id/payment
     */
    registerPayment: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { amount, method, paymentNumber } = req.body;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Buscar venta
            const sale = await Sale.findById(id).session(session);
            if (!sale) {
                throw errors.notFound('Venta');
            }

            if (sale.status !== 'active') {
                throw errors.badRequest(`La venta no está activa (estado: ${sale.status})`);
            }

            // Buscar el pago en la tabla de amortización
            const payment = sale.amortizationTable.find(p => p.number === paymentNumber);
            if (!payment) {
                throw errors.notFound('Pago en tabla de amortización');
            }

            if (payment.status === 'paid') {
                throw errors.badRequest('Este pago ya fue registrado');
            }

            // Crear registro de pago
            const newPayment = new Payment({
                sale: id,
                customer: sale.customer,
                receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                amount,
                concept: 'monthly_payment',
                method: method || 'cash',
                paymentDate: new Date()
            });

            await newPayment.save({ session });

            // Actualizar estado en tabla de amortización
            payment.status = 'paid';
            payment.paymentReference = newPayment._id;

            // Verificar si todos los pagos están completados
            const allPaid = sale.amortizationTable.every(p => p.status === 'paid');
            if (allPaid) {
                sale.status = 'paid';
            }

            await sale.save({ session });

            await session.commitTransaction();
            session.endSession();

            res.status(201).json({
                success: true,
                message: 'Pago registrado exitosamente',
                data: {
                    payment: newPayment,
                    sale: sale
                }
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }),

    /**
     * OBTENER ESTADISTICAS DE VENTAS
     * GET /api/sales/stats
     */
    getSalesStats: asyncHandler(async (req, res) => {
        // Total de ventas
        const total = await Sale.countDocuments();

        // Ventas por estado
        const statusStats = await Sale.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Monto total vendido
        const revenueStats = await Sale.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalDownPayments: { $sum: '$downPayment' },
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
                    totalDownPayments: 0,
                    totalBalance: 0
                }
            }
        });
    }),

    /**
     * CREAR VENTA MÚLTIPLE
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
                throw errors.badRequest('Máximo 100 nichos por venta');
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
                    status: 'pending'
                });
            }

            const newSale = new Sale({
                niche: nicheIds[0],
                customer: customerId,
                folio: `BULK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                totalAmount,
                downPayment,
                balance,
                monthsToPay: months,
                amortizationTable,
                status: 'active',
                notes: `Venta múltiple: ${nicheIds.length} nichos (${niches.map(n => n.code).join(', ')})`
            });

            await newSale.save({ session });

            const initialPayment = new Payment({
                sale: newSale._id,
                customer: customerId,
                receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                amount: downPayment,
                concept: 'down_payment',
                method: 'cash',
                paymentDate: new Date()
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

            await session.commitTransaction();
            session.endSession();

            res.status(201).json({
                success: true,
                message: `Venta múltiple registrada: ${nicheIds.length} nichos`,
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
