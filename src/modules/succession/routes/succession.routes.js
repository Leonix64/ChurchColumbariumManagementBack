const express = require('express');
const router = express.Router();
const successionController = require('../controllers/succession.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const validateMongoId = require('../../../middlewares/validateMongoId');

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
 * GET /api/succession/niche/:id/history
 * Obtener historial de titularidad de un nicho
 * Roles: admin, seller, viewer
 */
router.get('/niche/:id/history',
    validateMongoId('id'),
    successionController.getOwnershipHistory
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