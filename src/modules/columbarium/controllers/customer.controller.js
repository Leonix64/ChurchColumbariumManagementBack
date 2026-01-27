const Customer = require('../models/customer.model');
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
    })
};

module.exports = customerController;
