const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * POST /api/maintenance/niche/:id
 * Registrar pago de mantenimiento para un NICHO
 */
router.post('/niche/:id',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    maintenanceController.registerMaintenance
);

/**
 * GET /api/maintenance/niche/:id
 * Obtener pagos de mantenimiento de un NICHO
 */
router.get('/niche/:id',
    columbariumValidator.validateMongoId('id'),
    maintenanceController.getMaintenancePayments
);

/**
 * GET /api/maintenance/customer/:id/history
 * Obtener historial de mantenimientos que pagó un cliente
 * (aunque los nichos ya no sean suyos)
 */
router.get('/customer/:id/history',
    columbariumValidator.validateMongoId('id'),
    maintenanceController.getCustomerMaintenanceHistory
);

module.exports = router;