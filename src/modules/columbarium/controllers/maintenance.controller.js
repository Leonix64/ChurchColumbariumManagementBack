const Niche = require('../models/niche.model');
const Customer = require('../models/customer.model');
const Payment = require('../models/payment.model');
const Audit = require('../../audit/models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const maintenanceController = {
    /**
     * REGISTRAR PAGO DE MANTENIMIENTO
     * POST /api/niches/:id/maintenance
     */
    registerMaintenance: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { year, amount, method, notes } = req.body;

        // Validaciones básicas
        if (!year || !amount || !method) {
            throw errors.badRequest('Año, monto y método de pago son requeridos');
        }

        if (amount <= 0) {
            throw errors.badRequest('El monto debe ser mayor a 0');
        }

        // Validar que el año sea válido
        const currentYear = new Date().getFullYear();
        if (year > currentYear + 1) {
            throw errors.badRequest(`El año no puede ser mayor a ${currentYear + 1}`);
        }

        // Buscar nicho
        const niche = await Niche.findById(id).populate('currentOwner', 'firstName lastName phone email');

        if (!niche) {
            throw errors.notFound('Nicho');
        }

        // Verificar que el nicho esté vendido
        if (niche.status !== 'sold') {
            throw errors.badRequest('Solo se puede registrar mantenimiento para nichos vendidos');
        }

        // Verificar que tenga propietario
        if (!niche.currentOwner) {
            throw errors.badRequest('El nicho no tiene propietario registrado');
        }

        const owner = niche.currentOwner;

        // Verificar si ya existe un pago de mantenimiento para este nicho en este año
        const existingPayment = await Payment.findOne({
            niche: id,
            concept: 'maintenance',
            maintenanceYear: year
        });

        if (existingPayment) {
            throw errors.conflict(`Ya existe un pago de mantenimiento registrado para este nicho en el año ${year}`);
        }

        // Crear pago de mantenimiento
        const maintenancePayment = await Payment.create({
            niche: id,
            customer: owner._id, // Propietario ACTUAL al momento del pago
            sale: null,
            registeredBy: req.user?.id,
            receiptNumber: `MANT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            amount,
            concept: 'maintenance',
            method,
            maintenanceYear: year,
            paymentDate: new Date(),
            notes: notes || `Mantenimiento anual - Nicho ${niche.code}`,
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
                nicheId: id,
                nicheCode: niche.code,
                customerId: owner._id,
                customerName: `${owner.firstName} ${owner.lastName}`,
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
            message: `Pago de mantenimiento registrado para el nicho ${niche.code} (año ${year})`,
            data: {
                payment: maintenancePayment,
                niche: {
                    code: niche.code,
                    displayNumber: niche.displayNumber,
                    module: niche.module,
                    section: niche.section
                },
                owner: {
                    name: `${owner.firstName} ${owner.lastName}`,
                    phone: owner.phone,
                    email: owner.email
                }
            }
        });
    }),

    /**
     * OBTENER PAGOS DE MANTENIMIENTO DE UN NICHO
     * GET /api/niches/:id/maintenance
     */
    getMaintenancePayments: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const niche = await Niche.findById(id);
        if (!niche) {
            throw errors.notFound('Nicho');
        }

        // Buscar todos los pagos de mantenimiento del nicho
        const maintenancePayments = await Payment.find({
            niche: id,
            concept: 'maintenance'
        })
            .populate('customer', 'firstName lastName phone email')
            .populate('registeredBy', 'username fullName')
            .sort({ maintenanceYear: -1, paymentDate: -1 });

        res.status(200).json({
            success: true,
            count: maintenancePayments.length,
            niche: {
                code: niche.code,
                displayNumber: niche.displayNumber,
                module: niche.module
            },
            data: maintenancePayments
        });
    }),

    /**
     * OBTENER HISTORIAL DE MANTENIMIENTO POR CLIENTE
     * GET /api/customers/:id/maintenance-history
     * (Útil para ver qué mantenimientos pagó un cliente, aunque el nicho ya no sea suyo)
     */
    getCustomerMaintenanceHistory: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        // Buscar pagos de mantenimiento donde este cliente fue el que pagó
        const maintenancePayments = await Payment.find({
            customer: id,
            concept: 'maintenance'
        })
            .populate('niche', 'code displayNumber module section currentOwner')
            .populate('registeredBy', 'username fullName')
            .sort({ paymentDate: -1 });

        res.status(200).json({
            success: true,
            count: maintenancePayments.length,
            customer: {
                name: `${customer.firstName} ${customer.lastName}`,
                phone: customer.phone
            },
            data: maintenancePayments
        });
    })
};

module.exports = maintenanceController;
