const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');

// Aplicar autenticacion a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * GET /api/sales/stats
 * Obtener estadisticas de ventas
 * Roles: admin, seller
 */
router.get('/stats',
    authMiddleware.checkRole('admin', 'seller'),
    saleController.getSalesStats
);

/**
 * POST /api/sales/:id/cancel
 * Cancelar venta y liberar nicho
 * Roles: admin, seller (solo sus propias ventas y dentro de 24h)
 * Body: { reason, refundAmount, refundMethod, refundNotes }
 */
router.post('/:id/cancel',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    saleController.cancelSale
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
 * POST /api/sales/bulk
 * Crear venta multiple
 * Roles: admin, seller
 */
router.post('/bulk',
    authMiddleware.checkRole('admin', 'seller'),
    saleController.createBulkSale
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
 * Registrar pago mensual (FLEXIBLE)
 * Body: { amount, method, notes, paymentMode, specificPaymentNumber }
 * Roles: admin, seller
 */
router.post('/:id/payment',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    saleController.registerPayment
);

module.exports = router;
