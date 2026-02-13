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

        // Validar que vengan al menos 3 beneficiarios
        if (!beneficiaries || beneficiaries.length < 3) {
            throw errors.badRequest('Debe haber al menos 3 beneficiarios registrados');
        }

        // Validar estructura de beneficiarios
        beneficiaries.forEach((b, index) => {
            if (!b.name || !b.relationship) {
                throw errors.badRequest(`Beneficiario ${index + 1}: nombre y relacion son requeridos`);
            }
            if (!b.order) {
                b.order = index + 1; // Asignar orden automatico
            }
        });

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

        // Auditoría
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
                customerName: `${newCustomer.firstName} ${newCustomer.lastName}`,
                beneficiariesCount: newCustomer.beneficiaries.length
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
    }),

    /**
     * ACTUALIZAR BENEFICIARIOS
     * PUT /api/customers/:id/beneficiaries
     */
    updateBeneficiaries: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { beneficiaries } = req.body;

        if (!beneficiaries || beneficiaries.length < 3) {
            throw errors.badRequest('Se requieren al menos 3 beneficiarios');
        }

        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        const oldBeneficiaries = customer.beneficiaries;
        customer.beneficiaries = beneficiaries;
        await customer.save();

        // Auditoría
        await Audit.create({
            user: req.user?.id,
            username: req.user?.username,
            userRole: req.user?.role,
            action: 'update_beneficiaries',
            module: 'customer',
            resourceType: 'Customer',
            resourceId: customer._id,
            details: {
                customerId: customer._id,
                customerName: `${customer.firstName} ${customer.lastName}`,
                before: { count: oldBeneficiaries.length },
                after: { count: beneficiaries.length }
            },
            status: 'success',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(200).json({
            success: true,
            message: 'Beneficiarios actualizados',
            data: customer
        });
    }),

    /**
     * MARCAR BENEFICIARIO COMO FALLECIDO
     * POST /api/customers/:id/beneficiaries/:beneficiaryId/deceased
     */
    markBeneficiaryDeceased: asyncHandler(async (req, res) => {
        const { id, beneficiaryId } = req.params;
        const { deceasedDate, notes } = req.body;

        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        const beneficiary = customer.beneficiaries.id(beneficiaryId);
        if (!beneficiary) {
            throw errors.notFound('Beneficiario');
        }

        if (beneficiary.isDeceased) {
            throw errors.badRequest('El beneficiario ya está marcado como fallecido');
        }

        beneficiary.isDeceased = true;
        beneficiary.deceasedDate = deceasedDate || new Date();
        if (notes) {
            beneficiary.notes = notes;
        }
        await customer.save();

        // Auditoría
        await Audit.create({
            user: req.user?.id,
            username: req.user?.username,
            userRole: req.user?.role,
            action: 'mark_beneficiary_deceased',
            module: 'customer',
            resourceType: 'Customer',
            resourceId: customer._id,
            details: {
                customerId: customer._id,
                beneficiaryName: beneficiary.name,
                deceasedDate: beneficiary.deceasedDate,
                notes: beneficiary.notes || undefined
            },
            status: 'success',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(200).json({
            success: true,
            message: 'Beneficiario marcado como fallecido',
            data: customer
        });
    }),

    /**
     * OBTENER PRÓXIMO BENEFICIARIO VIVO
     * GET /api/customers/:id/next-beneficiary
     */
    getNextBeneficiary: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        const nextBeneficiary = customer.getNextBeneficiary();

        if (!nextBeneficiary) {
            return res.status(200).json({
                success: true,
                message: 'No hay beneficiarios vivos disponibles',
                data: null
            });
        }

        res.status(200).json({
            success: true,
            data: nextBeneficiary
        });
    })
};

module.exports = customerController;
