const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const validateMongoId = require('../../../middlewares/validateMongoId');
const customerValidator = require('../validators/customer.validator');

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * POST /api/customers
 * Crear nuevo cliente
 * Roles: admin, seller
 */
router.post('/',
    authMiddleware.checkRole('admin', 'seller'),
    customerValidator.validateCreateCustomer,
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
    validateMongoId('id'),
    customerController.getCustomerById
);

/**
 * PUT /api/customers/:id
 * Actualizar cliente
 * Roles: admin, seller
 */
router.put('/:id',
    authMiddleware.checkRole('admin', 'seller'),
    validateMongoId('id'),
    customerController.updateCustomer
);

/**
 * DELETE /api/customers/:id
 * Desactivar cliente (soft delete)
 * Roles: solo admin
 */
router.delete('/:id',
    authMiddleware.checkRole('admin'),
    validateMongoId('id'),
    customerController.deleteCustomer
);

/**
 * PATCH /api/customers/:id/activate
 * Reactivar cliente
 * Roles: solo admin
 */
router.patch('/:id/activate',
    authMiddleware.checkRole('admin'),
    validateMongoId('id'),
    customerController.activateCustomer
);

/**
 * GET /api/customers/:id/sales
 * Obtener ventas de un cliente
 * Roles: todos los autenticados
 */
router.get('/:id/sales',
    validateMongoId('id'),
    customerController.getSalesByCustomer
);

/**
 * PUT /api/customers/:id/beneficiaries
 * Actualizar beneficiarios (LEGACY)
 * @deprecated Usar PUT /api/beneficiaries/niche/:nicheId
 */
router.put('/:id/beneficiaries',
    authMiddleware.checkRole('admin', 'seller'),
    validateMongoId('id'),
    customerController.updateBeneficiaries
);

/**
 * POST /api/customers/:id/beneficiaries/:beneficiaryId/deceased
 * Marcar beneficiario como fallecido (LEGACY)
 * @deprecated Usar POST /api/beneficiaries/:id/deceased
 */
router.post('/:id/beneficiaries/:beneficiaryId/deceased',
    authMiddleware.checkRole('admin', 'seller'),
    validateMongoId('id'),
    customerController.markBeneficiaryDeceased
);

/**
 * GET /api/customers/:id/next-beneficiary
 * Obtener próximo beneficiario vivo (LEGACY)
 * @deprecated Usar GET /api/beneficiaries/niche/:nicheId/next
 */
router.get('/:id/next-beneficiary',
    validateMongoId('id'),
    customerController.getNextBeneficiary
);

module.exports = router;
