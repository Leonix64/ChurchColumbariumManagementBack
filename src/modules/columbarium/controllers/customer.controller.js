const Customer = require('../models/customer.model');
const Sale = require('../models/sale.model');
const Payment = require('../models/payment.model');
const Audit = require('../../audit/models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const customerController = {
    /**
     * CREAR NUEVO CLIENTE
     * POST /api/customers
     */
    createCustomer: asyncHandler(async (req, res) => {
        const { firstName, lastName, phone, email, rfc, address, emergencyContact, beneficiaries } = req.body;

        // Verificar si ya existe un cliente con el mismo RFC (si se proporciona)
        if (rfc) {
            const existingCustomer = await Customer.findOne({ rfc: rfc.toUpperCase() });
            if (existingCustomer) {
                throw errors.conflict('Ya existe un cliente con ese RFC');
            }
        }

        // Crear cliente
        const newCustomer = await Customer.create({
            firstName,
            lastName,
            phone,
            email,
            rfc,
            address,
            emergencyContact,
            beneficiaries,
            active: true
        });

        res.status(201).json({
            success: true,
            message: 'Cliente creado exitosamente',
            data: newCustomer
        });
    }),

    /**
     * BUSCAR CLIENTES
     * GET /api/customers
     * Query params: search (busca en nombre, apellido o RFC)
     */
    getCustomers: asyncHandler(async (req, res) => {
        const { search, active } = req.query;
        let query = {};

        // Filtro por busqueda de texto
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { rfc: { $regex: search, $options: 'i' } }
            ];
        }

        // Filtro por estado activo/inactivo
        if (active !== undefined) {
            query.active = active === 'true';
        }

        const customers = await Customer.find(query)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: customers.length,
            data: customers
        });
    }),

    /**
     * OBTENER CLIENTE POR ID
     * GET /api/customers/:id
     */
    getCustomerById: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findById(id);

        if (!customer) {
            throw errors.notFound('Cliente');
        }

        res.status(200).json({
            success: true,
            data: customer
        });
    }),

    /**
     * ACTUALIZAR CLIENTE
     * PUT /api/customers/:id
     */
    updateCustomer: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        // No permitir actualizar ciertos campos
        delete updates._id;
        delete updates.createdAt;
        delete updates.updatedAt;

        // Si se actualiza RFC, verificar que no exista
        if (updates.rfc) {
            const existingCustomer = await Customer.findOne({
                rfc: updates.rfc.toUpperCase(),
                _id: { $ne: id }
            });

            if (existingCustomer) {
                throw errors.conflict('Ya existe un cliente con ese RFC');
            }
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        if (!updatedCustomer) {
            throw errors.notFound('Cliente');
        }

        res.status(200).json({
            success: true,
            message: 'Cliente actualizado',
            data: updatedCustomer
        });
    }),

    /**
     * DESACTIVAR CLIENTE (soft delete)
     * DELETE /api/customers/:id
     */
    deleteCustomer: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findByIdAndUpdate(
            id,
            { active: false },
            { new: true }
        );

        if (!customer) {
            throw errors.notFound('Cliente');
        }

        res.status(200).json({
            success: true,
            message: 'Cliente desactivado',
            data: customer
        });
    }),

    /**
     * REACTIVAR CLIENTE
     * PATCH /api/customers/:id/activate
     */
    activateCustomer: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findByIdAndUpdate(
            id,
            { active: true },
            { new: true }
        );

        if (!customer) {
            throw errors.notFound('Cliente');
        }

        res.status(200).json({
            success: true,
            message: 'Cliente reactivado',
            data: customer
        });
    }),

    /**
     * BUSCAR CLIENTES CON PAGINACION
     * GET /api/customers/search
     * Query params: search, limit, page
     */
    searchCustomers: asyncHandler(async (req, res) => {
        const { search, limit = 20, page = 1 } = req.query;

        let filter = { active: true };

        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { rfc: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const customers = await Customer.find(filter)
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Customer.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: customers.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: customers
        });
    }),

    /**
     * OBTENER VENTAS DE UN CLIENTE
     * GET /api/customers/:id/sales
     */
    getSalesByCustomer: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        const sales = await Sale.find({ customer: id })
            .populate('niche', 'code displayNumber module section type price')
            .sort({ createdAt: -1 });

        // Calcular estadísticas
        const stats = {
            totalSales: sales.length,
            activeSales: sales.filter(s => s.status === 'active').length,
            paidSales: sales.filter(s => s.status === 'paid').length,
            totalInvested: sales.reduce((sum, s) => sum + s.totalAmount, 0),
            totalPaid: sales.reduce((sum, s) => sum + s.totalPaid, 0),
            totalPending: sales.reduce((sum, s) => sum + s.balance, 0)
        };

        res.status(200).json({
            success: true,
            count: sales.length,
            data: sales,
            stats
        });
    }),

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

module.exports = customerController;
