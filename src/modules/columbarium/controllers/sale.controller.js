const Sale = require('../models/sale.model');
const AmortSchedule = require('../models/amortSchedule.model');
const PaymentScheduleLink = require('../models/paymentScheduleLink.model');
const Refund = require('../models/refund.model');

const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const { toNumber } = require('../../../utils/decimal');
const { createSale, cancelSale } = require('../services/sale.service');
const { registerPayment } = require('../services/payment.service');
const { updateOverdueEntries } = require('../services/amortization.service');
const { buildUserContext } = require('../../../utils/requestHelpers');

const saleController = {

    /**
     * CREAR NUEVA VENTA
     * POST /api/sales
     */
    createSale: asyncHandler(async (req, res) => {
        const { nicheId, customerId, totalAmount, downPayment } = req.body;
        const result = await createSale({ nicheId, customerId, totalAmount, downPayment }, buildUserContext(req));

        res.status(201).json({
            success: true,
            message: 'Venta registrada exitosamente',
            data: result
        });
    }),

    /**
     * REGISTRAR PAGO FLEXIBLE (Parcial/Adelantado/Excedente)
     * POST /api/sales/:id/payment
     */
    registerPayment: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { amount, method, notes, paymentMode, specificPaymentNumber } = req.body;
        const result = await registerPayment(
            id,
            { amount, method, notes, paymentMode, specificPaymentNumber },
            buildUserContext(req)
        );

        res.status(201).json({
            success: true,
            message: 'Pago registrado exitosamente',
            data: result
        });
    }),

    /**
     * OBTENER VENTA POR ID (con schedule de AmortSchedule y pagos vinculados)
     * GET /api/sales/:id
     */
    getSaleById: asyncHandler(async (req, res) => {
        const { id } = req.params;

        await updateOverdueEntries(id);

        const [sale, schedule] = await Promise.all([
            Sale.findById(id)
                .populate('customer', 'firstName lastName phone email address')
                .populate('niche', 'code displayNumber module section type price')
                .populate('user', 'username fullName'),
            AmortSchedule.find({ sale: id }).sort({ number: 1 }).lean()
        ]);

        if (!sale) throw errors.notFound('Venta');

        const saleObj = sale.toObject();

        // Serializar Decimal128 del sale
        ['totalAmount', 'downPayment', 'balance', 'totalPaid'].forEach(f => {
            if (saleObj[f] != null) saleObj[f] = parseFloat(saleObj[f].toString());
        });
        if (saleObj.niche?.price) {
            saleObj.niche.price = parseFloat(saleObj.niche.price.toString());
        }

        // Cargar vínculos pago ↔ cuota y agrupar por cuota
        const scheduleIds = schedule.map(s => s._id);
        const links = await PaymentScheduleLink
            .find({ amortEntry: { $in: scheduleIds } })
            .populate('payment', 'receiptNumber amount method paymentDate notes')
            .lean();

        const linksByEntry = {};
        links.forEach(link => {
            const key = link.amortEntry.toString();
            if (!linksByEntry[key]) linksByEntry[key] = [];
            const pmt = link.payment;
            if (pmt?.amount != null) pmt.amount = parseFloat(pmt.amount.toString());
            linksByEntry[key].push({
                appliedAmount: parseFloat(link.appliedAmount.toString()),
                paidOn: link.paidOn || link.createdAt,
                paymentId: pmt
            });
        });

        // Enriquecer schedule: Decimal128 → number + inyectar payments[]
        const enrichedSchedule = (schedule || []).map(entry => ({
            ...entry,
            amount: entry.amount ? parseFloat(entry.amount.toString()) : 0,
            amountPaid: entry.amountPaid ? parseFloat(entry.amountPaid.toString()) : 0,
            amountRemaining: entry.amountRemaining ? parseFloat(entry.amountRemaining.toString()) : 0,
            payments: linksByEntry[entry._id.toString()] || []
        }));

        // Cargar reembolso si la venta está cancelada
        let refundData = null;
        if (saleObj.status === 'cancelled') {
            const refundDoc = await Refund.findOne({ sale: id })
                .select('amount method reason refundDate status receiptNumber')
                .lean();
            if (refundDoc) {
                if (refundDoc.amount != null) refundDoc.amount = parseFloat(refundDoc.amount.toString());
                refundData = refundDoc;
            }
            if (saleObj.cancellationInfo?.refundAmount != null) {
                saleObj.cancellationInfo.refundAmount = parseFloat(
                    saleObj.cancellationInfo.refundAmount.toString()
                );
            }
        }

        res.status(200).json({
            success: true,
            data: { ...saleObj, schedule: enrichedSchedule, refund: refundData }
        });
    }),

    /**
     * LISTAR TODAS LAS VENTAS
     * GET /api/sales
     */
    getAllSales: asyncHandler(async (req, res) => {
        const { status, customerId } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (customerId) filter.customer = customerId;

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

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

        const salesData = sales.map(s => {
            const obj = s.toObject();
            ['totalAmount', 'downPayment', 'balance', 'totalPaid'].forEach(f => {
                if (obj[f] != null) obj[f] = parseFloat(obj[f].toString());
            });
            return obj;
        });

        res.status(200).json({
            success: true,
            data: salesData,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) }
        });
    }),

    /**
     * CANCELAR VENTA
     * POST /api/sales/:id/cancel
     */
    cancelSale: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason, refundAmount, refundMethod, refundNotes } = req.body;

        // Validación básica del motivo en el controlador (es requisito de entrada HTTP)
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'El motivo debe tener al menos 10 caracteres',
                details: [{ field: 'reason', message: 'El motivo es requerido y debe tener al menos 10 caracteres' }]
            });
        }

        const { sale, niche, refund } = await cancelSale(
            id,
            { reason, refundAmount, refundMethod, refundNotes },
            buildUserContext(req)
        );

        // Serializar Decimal128 para la respuesta
        const saleObj = sale.toObject();
        ['totalAmount', 'downPayment', 'balance', 'totalPaid'].forEach(f => {
            if (saleObj[f] != null) saleObj[f] = parseFloat(saleObj[f].toString());
        });
        if (saleObj.cancellationInfo?.refundAmount != null) {
            saleObj.cancellationInfo.refundAmount = parseFloat(
                saleObj.cancellationInfo.refundAmount.toString()
            );
        }

        const nicheObj = niche.toObject();
        if (nicheObj.price != null) nicheObj.price = parseFloat(nicheObj.price.toString());

        let refundObj = null;
        if (refund) {
            refundObj = refund.toObject();
            if (refundObj.amount != null) refundObj.amount = parseFloat(refundObj.amount.toString());
        }

        return res.status(200).json({
            success: true,
            message: 'Venta cancelada exitosamente',
            data: { sale: saleObj, niche: nicheObj, refund: refundObj }
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

        const rawRevenue = revenueStats[0];
        const revenue = rawRevenue
            ? {
                totalRevenue: toNumber(rawRevenue.totalRevenue),
                totalPaid: toNumber(rawRevenue.totalPaid),
                totalBalance: toNumber(rawRevenue.totalBalance)
            }
            : { totalRevenue: 0, totalPaid: 0, totalBalance: 0 };

        res.status(200).json({
            success: true,
            data: { total, byStatus: statusStats, revenue }
        });
    })
};

module.exports = saleController;
