const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * POST /api/customers
 * Crear nuevo cliente
 * Roles: admin, seller
 */
router.post('/',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateCreateCustomer,
    customerController.createCustomer
);

/**
 * GET /api/customers
 * Listar clientes (con búsqueda)
 * Query params: search, active
 * Roles: todos los autenticados
 */
router.get('/',
    customerController.getCustomers
);

/**
 * GET /api/customers/search
 * Buscar clientes con paginacion
 * Query params: search, limit, page
 */
router.get('/search',
    customerController.searchCustomers
);

/**
 * GET /api/customers/:id
 * Obtener cliente por ID
 * Roles: todos los autenticados
 */
router.get('/:id',
    columbariumValidator.validateMongoId('id'),
    customerController.getCustomerById
);

/**
 * PUT /api/customers/:id
 * Actualizar cliente
 * Roles: admin, seller
 */
router.put('/:id',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    customerController.updateCustomer
);

/**
 * DELETE /api/customers/:id
 * Desactivar cliente (soft delete)
 * Roles: solo admin
 */
router.delete('/:id',
    authMiddleware.checkRole('admin'),
    columbariumValidator.validateMongoId('id'),
    customerController.deleteCustomer
);

/**
 * PATCH /api/customers/:id/activate
 * Reactivar cliente
 * Roles: solo admin
 */
router.patch('/:id/activate',
    authMiddleware.checkRole('admin'),
    columbariumValidator.validateMongoId('id'),
    customerController.activateCustomer
);

module.exports = router;
