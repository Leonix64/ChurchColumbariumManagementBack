const Customer = require('../models/customer.model');
const Sale = require('../models/sale.model');
const Payment = require('../models/payment.model');
const Audit = require('../../audit/models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const maintenanceController = {
    /**
     * REGISTRAR PAGO DE MANTENIMIENTO
     * POST /api/customers/:id/maintenance
     */
    registerMaintenance: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { year, amount, method, notes } = req.body;

        // Validaciones
        if (!year || !amount || !method) {
            throw errors.badRequest('Año, monto y método de pago son requeridos');
        }

        if (amount <= 0) {
            throw errors.badRequest('El monto debe ser mayor a 0');
        }

        // Validar que el año sea válido (no mayor al actual + 1)
        const currentYear = new Date().getFullYear();
        if (year > currentYear + 1) {
            throw errors.badRequest(`El año no puede ser mayor a ${currentYear + 1}`);
        }

        // Buscar cliente
        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        if (!customer.active) {
            throw errors.badRequest('El cliente está inactivo');
        }

        // Verificar que el cliente tenga ventas activas o pagadas (menos  estricto)
        const customerSales = await Sale.find({
            customer: id,
            status: { $in: ['active', 'paid', 'overdue'] } // Solo ventas validas
        });

        if (customerSales.length === 0) {
            throw errors.badRequest('El cliente no tiene compras activas. Solo se puede registrar mantenimiento para clientes con nichos adquiridos.');
        }

        /* Varificar que tenga al menos 1 venta totalmente pagada (mas estricto)
        const hasPaidSale = customerSales.some(s => s.status === 'paid');
        if (!hasPaidSale) {
            throw errors.badRequest('El cliente debe tener al menos una compra completamente pagada para registrar mantenimiento.');
        } */

        // Verificar si ya existe un pago de mantenimiento para este año
        const existingPayment = await Payment.findOne({
            customer: id,
            concept: 'maintenance',
            maintenanceYear: year
        });

        if (existingPayment) {
            throw errors.conflict(`Ya existe un pago de mantenimiento registrado para el año ${year}`);
        }

        // Crear pago de mantenimiento
        const maintenancePayment = await Payment.create({
            customer: id,
            sale: null, // No está asociado a una venta
            registeredBy: req.user?.id,
            receiptNumber: `MANT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            amount,
            concept: 'maintenance',
            method,
            maintenanceYear: year,
            paymentDate: new Date(),
            notes: notes || '',
            balanceBefore: 0,
            balanceAfter: 0
        });

        // Registrar auditoría
        await Audit.create({
            user: req.user?.id,
            username: req.user?.username,
            userRole: req.user?.role,
            action: 'register_maintenance',
            module: 'payment',
            resourceType: 'Payment',
            resourceId: maintenancePayment._id,
            details: {
                customerId: id,
                customerName: `${customer.firstName} ${customer.lastName}`,
                paymentId: maintenancePayment._id,
                receiptNumber: maintenancePayment.receiptNumber,
                amount,
                method,
                year,
                concept: 'maintenance'
            },
            status: 'success',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(201).json({
            success: true,
            message: `Pago de mantenimiento registrado para el año ${year}`,
            data: maintenancePayment
        });
    }),

    /**
     * OBTENER PAGOS DE MANTENIMIENTO DE UN CLIENTE
     * GET /api/customers/:id/maintenance
     */
    getMaintenancePayments: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        // Buscar todos los pagos de mantenimiento del cliente
        const maintenancePayments = await Payment.find({
            customer: id,
            concept: 'maintenance'
        })
            .populate('registeredBy', 'username fullName')
            .sort({ maintenanceYear: -1, paymentDate: -1 });

        res.status(200).json({
            success: true,
            count: maintenancePayments.length,
            data: maintenancePayments
        });
    })
};

module.exports = maintenanceController;