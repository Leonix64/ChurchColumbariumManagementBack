const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const validateMongoId = require('../../../middlewares/validateMongoId');

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * POST /api/maintenance/niche/:id
 * Registrar pago de mantenimiento para un NICHO
 */
router.post('/niche/:id',
    authMiddleware.checkRole('admin', 'seller'),
    validateMongoId('id'),
    maintenanceController.registerMaintenance
);

/**
 * GET /api/maintenance/niche/:id
 * Obtener pagos de mantenimiento de un NICHO
 */
router.get('/niche/:id',
    validateMongoId('id'),
    maintenanceController.getMaintenancePayments
);

/**
 * GET /api/maintenance/customer/:id/history
 * Obtener historial de mantenimientos que pagó un cliente
 * (aunque los nichos ya no sean suyos)
 */
router.get('/customer/:id/history',
    validateMongoId('id'),
    maintenanceController.getCustomerMaintenanceHistory
);

/**
 * POST /api/maintenance/backfill
 * Migrar datos existentes al nuevo modelo de dominio
 * Solo admin, ejecutar una sola vez
 */
router.post('/backfill',
    authMiddleware.checkRole('admin'),
    maintenanceController.backfillData
);

module.exports = router;