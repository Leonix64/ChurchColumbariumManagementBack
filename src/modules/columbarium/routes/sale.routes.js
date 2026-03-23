const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');
const { ROLES } = require('../../../config/constants');

// Aplicar autenticacion a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * GET /api/sales/stats
 * Obtener estadisticas de ventas
 * Roles: admin, seller
 */
router.get('/stats',
    authMiddleware.checkRole(ROLES.ADMIN, ROLES.SELLER),
    saleController.getSalesStats
);

/**
 * POST /api/sales/:id/cancel
 * Cancelar venta y liberar nicho
 * Roles: admin, seller (solo sus propias ventas y dentro de 24h)
 * Body: { reason, refundAmount, refundMethod, refundNotes }
 */
router.post('/:id/cancel',
    authMiddleware.checkRole(ROLES.ADMIN, ROLES.SELLER),
    columbariumValidator.validateMongoId('id'),
    saleController.cancelSale
);

/**
 * POST /api/sales
 * Crear nueva venta
 * Roles: admin, seller
 */
router.post('/',
    authMiddleware.checkRole(ROLES.ADMIN, ROLES.SELLER),
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
    authMiddleware.checkRole(ROLES.ADMIN, ROLES.SELLER),
    saleController.getAllSales
);

/**
 * GET /api/sales/:id
 * Obtener venta por ID
 * Roles: admin, seller
 */
router.get('/:id',
    authMiddleware.checkRole(ROLES.ADMIN, ROLES.SELLER),
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
    authMiddleware.checkRole(ROLES.ADMIN, ROLES.SELLER),
    columbariumValidator.validateMongoId('id'),
    saleController.registerPayment
);

module.exports = router;
