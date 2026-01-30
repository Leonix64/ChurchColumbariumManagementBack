const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * POST /api/customers/:id/maintenance
 * Registrar pago de mantenimiento
 */
router.post('/:id/maintenance',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    maintenanceController.registerMaintenance
);

/**
 * GET /api/customers/:id/maintenance
 * Obtener pagos de mantenimiento de un cliente
 */
router.get('/:id/maintenance',
    columbariumValidator.validateMongoId('id'),
    maintenanceController.getMaintenancePayments
);

module.exports = router;