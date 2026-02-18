const Sale = require('../models/sale.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const saleService = require('../services/sale.service');
const paymentService = require('../services/payment.service');

const saleController = {
    /**
     * CREAR NUEVA VENTA
     * POST /api/sales
     */
    createSale: asyncHandler(async (req, res) => {
        const { nicheId, customerId, totalAmount, downPayment } = req.body;

        const result = await saleService.createSale({
            nicheId, customerId, totalAmount, downPayment,
            user: req.user, req
        });

        res.status(201).json({
            success: true,
            message: 'Venta registrada exitosamente',
            data: result
        });
    }),

    /**
     * REGISTRAR PAGO FLEXIBLE
     * POST /api/sales/:id/payment
     */
    registerPayment: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { amount, method, notes, paymentMode, specificPaymentNumber } = req.body;

        const result = await paymentService.registerPayment({
            saleId: id, amount, method, notes, paymentMode, specificPaymentNumber,
            user: req.user, req
        });

        res.status(201).json({
            success: true,
            message: 'Pago registrado exitosamente',
            data: result
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
            .populate('originalCustomer', 'firstName lastName phone email')
            .populate('currentCustomer', 'firstName lastName phone email')
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

        // Validar motivo (OBLIGATORIO)
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'El motivo debe tener al menos 10 caracteres',
                details: [{ field: 'reason', message: 'El motivo es requerido y debe tener al menos 10 caracteres' }]
            });
        }

        // Validar refund amount
        if (refundAmount !== undefined && refundAmount !== null && refundAmount !== '') {
            const val = Number(refundAmount);
            if (isNaN(val)) {
                return res.status(400).json({
                    success: false,
                    message: 'El monto de reembolso debe ser un número válido',
                    details: [{ field: 'refundAmount', message: 'Debe ser un número válido' }]
                });
            }
            if (val < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El monto de reembolso no puede ser negativo',
                    details: [{ field: 'refundAmount', message: 'No puede ser negativo' }]
                });
            }
        }

        const result = await saleService.cancelSale({
            saleId: id, reason, refundAmount, refundMethod, refundNotes,
            user: req.user, req
        });

        res.status(200).json({
            success: true,
            message: 'Venta cancelada exitosamente',
            data: result
        });
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
                revenue: revenueStats[0] || { totalRevenue: 0, totalPaid: 0, totalBalance: 0 }
            }
        });
    }),

    /**
     * CREAR VENTA MULTIPLE
     * POST /api/sales/bulk
     */
    createBulkSale: asyncHandler(async (req, res) => {
        const { nicheIds, customerId, totalAmount, downPayment } = req.body;

        const result = await saleService.createBulkSale({
            nicheIds, customerId, totalAmount, downPayment,
            user: req.user, req
        });

        res.status(201).json({
            success: true,
            message: `Venta multiple registrada: ${nicheIds.length} nichos`,
            data: {
                sale: result.sale,
                payment: result.payment,
                niches: result.niches.map(n => ({
                    code: n.code,
                    displayNumber: n.displayNumber,
                    type: n.type,
                    price: n.price
                }))
            }
        });
    })
};

module.exports = saleController;
