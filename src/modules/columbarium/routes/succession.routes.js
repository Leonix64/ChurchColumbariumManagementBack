const express = require('express');
const router = express.Router();
const successionController = require('../controllers/succession.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');

// Aplicar autenticación
router.use(authMiddleware.verifyToken);

/**
 * POST /api/succession/register
 * Registrar fallecimiento y sucesión automática
 * Roles: admin, seller
 */
router.post('/register',
    authMiddleware.checkRole('admin', 'seller'),
    successionController.registerSuccession
);

/**
 * GET /api/succession/niche/:nicheId/history
 * Obtener historial de sucesiones de un nicho
 * Roles: admin, seller
 */
router.get('/niche/:nicheId/history',
    authMiddleware.checkRole('admin', 'seller'),
    successionController.getNicheSuccessionHistory
);

/**
 * GET /api/succession/customer/:customerId/history
 * Obtener historial de sucesiones de un cliente
 * Roles: admin, seller
 */
router.get('/customer/:customerId/history',
    authMiddleware.checkRole('admin', 'seller'),
    successionController.getCustomerSuccessionHistory
);

/**
 * POST /api/succession/transfer
 * Transferencia manual de titularidad
 * Roles: solo admin
 */
router.post('/transfer',
    authMiddleware.checkRole('admin'),
    successionController.manualTransfer
);

module.exports = router;