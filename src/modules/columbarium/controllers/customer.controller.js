const Customer = require('../models/customer.model');
const Sale = require('../models/sale.model');
const Audit = require('../../audit/models/audit.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');

const customerController = {

    /**
     * CREAR NUEVO CLIENTE
     * POST /api/customers
     */
    createCustomer: asyncHandler(async (req, res) => {
        const { firstName, lastName, phone, email, rfc, address, emergencyContact } = req.body;

        if (rfc) {
            const existingCustomer = await Customer.findOne({ rfc: rfc.toUpperCase() });
            if (existingCustomer) {
                throw errors.conflict('Ya existe un cliente con ese RFC');
            }
        }

        const newCustomer = await Customer.create({
            firstName,
            lastName,
            phone,
            email,
            rfc,
            address,
            emergencyContact,
            active: true
        });

        await Audit.create({
            user: req.user?.id,
            username: req.user?.username,
            userRole: req.user?.role,
            action: 'create_customer',
            module: 'customer',
            resourceType: 'Customer',
            resourceId: newCustomer._id,
            details: {
                customerId: newCustomer._id,
                customerName: `${newCustomer.firstName} ${newCustomer.lastName}`
            },
            status: 'success',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(201).json({
            success: true,
            message: 'Cliente creado exitosamente',
            data: newCustomer
        });
    }),

    /**
     * BUSCAR CLIENTES CON FILTROS
     * GET /api/customers
     * Query params: search (text index), active (boolean)
     */
    getCustomers: asyncHandler(async (req, res) => {
        const { search, active } = req.query;
        let query = {};

        // Filtro por busqueda de texto (usa text index sobre firstName, lastName, rfc)
        if (search) {
            query.$text = { $search: search };
        }

        if (active !== undefined) {
            query.active = active === 'true';
        }

        const customers = await Customer.find(query)
            .select(search ? { score: { $meta: 'textScore' } } : {})
            .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 });

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

        delete updates._id;
        delete updates.createdAt;
        delete updates.updatedAt;

        // Validar unicidad de RFC si se está actualizando
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
     * OBTENER VENTAS DE UN CLIENTE CON ESTADÍSTICAS
     * GET /api/customers/:id/sales
     * Incluye métricas: total invertido, pagado, pendiente
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

        // Calcular estadísticas (excluyendo ventas canceladas)
        const validSales = sales.filter(s => s.status !== 'cancelled');
        const stats = {
            totalSales: sales.length,
            activeSales: sales.filter(s => s.status === 'active').length,
            paidSales: sales.filter(s => s.status === 'paid').length,
            cancelledSales: sales.filter(s => s.status === 'cancelled').length,
            totalInvested: validSales.reduce((sum, s) => sum + s.totalAmount, 0),
            totalPaid: validSales.reduce((sum, s) => sum + (s.totalPaid || 0), 0),
            totalPending: validSales.reduce((sum, s) => sum + (s.balance || 0), 0)
        };

        res.status(200).json({
            success: true,
            count: sales.length,
            data: sales,
            stats
        });
    })
};

module.exports = customerController;
