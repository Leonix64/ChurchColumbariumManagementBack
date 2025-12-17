const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * GET /api/sales/stats
 * Obtener estadísticas de ventas
 * Roles: admin, seller
 */
router.get('/stats',
    authMiddleware.checkRole('admin', 'seller'),
    saleController.getSalesStats
);

/**
 * POST /api/sales
 * Crear nueva venta
 * Roles: admin, seller
 */
router.post('/',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateCreateSale,
    saleController.createSale
);

/**
 * GET /api/sales
 * Listar todas las ventas
 * Query params: status, customerId
 * Roles: admin, seller
 */
router.get('/',
    authMiddleware.checkRole('admin', 'seller'),
    saleController.getAllSales
);

/**
 * GET /api/sales/:id
 * Obtener venta por ID
 * Roles: admin, seller
 */
router.get('/:id',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    saleController.getSaleById
);

/**
 * POST /api/sales/:id/payment
 * Registrar pago mensual
 * Body: { amount, method, paymentNumber }
 * Roles: admin, seller
 */
router.post('/:id/payment',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    saleController.registerPayment
);

// Venta múltiple
router.post('/bulk',
    authMiddleware.checkRole('admin', 'seller'),
    saleController.createBulkSale
);

module.exports = router;
