const Customer = require('../models/customer.model');

const customerController = {
    /**
     * POST /api/customers
     * Crea un nuevo cliente
     */
    createCustomer: async (req, res) => {
        try {
            const newCustomer = new Customer(req.body);
            await newCustomer.save();

            res.status(201).json({
                success: true,
                message: 'Cliente creado exitosamente',
                data: newCustomer
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    },

    /**
     * GET /api/customers
     * Busca clientes por nombre, apellido o RFC
     * Ejemplo:
     *  /api/customers?search=perez
     *  /api/customers?search=PERJ800101
     */
    getCustomers: async (req, res) => {
        try {
            const { search } = req.query;
            let query = {};

            if (search) {
                query = {
                    $or: [
                        { firstName: { $regex: search, $options: 'i' } },
                        { lastName: { $regex: search, $options: 'i' } },
                        { rfc: { $regex: search, $options: 'i' } }
                    ]
                };
            }

            const customers = await Customer.find(query);

            res.status(200).json({
                success: true,
                count: customers.length,
                data: customers
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = customerController;
