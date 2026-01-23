const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');

// Solo admin puede acceder a los logs
router.use(authMiddleware.verifyToken);
router.use(authMiddleware.checkRole('admin'));

/**
 * GET /api/audit
 * Listar todos los logs de auditoria
 * Query params: module, action, user, startDate, endDate, status, limit, page
 */
router.get('/', auditController.getAllLogs);

/**
 * GET /api/audit/stats
 * Estadisticas de auditoria
 * Query params: startDate, endDate
 */
router.get('/stats', auditController.getStats);

/**
 * GET /api/audit/recent
 * Actividad reciente (ultimos N logs)
 * Query params: limit
 */
router.get('/recent', auditController.getRecentActivity);

/**
 * GET /api/audit/report
 * Reporte de actividad por rango de fechas
 * Query params: startDate, endDate, groupBy (hour|day|week|month)
 */
router.get('/report', auditController.getActivityReport);

/**
 * GET /api/audit/resource/:resourceId
 * Historial de un recurso especifico
 */
router.get('/resource/:resourceId', auditController.getResourceHistory);

/**
 * GET /api/audit/user/:userId
 * Historial de un usuario especifico
 * Query params: limit, page
 */
router.get('/user/:userId', auditController.getUserHistory);

/**
 * POST /api/audit
 * Crear log manualmente (casos especiales)
 * Body: { action, module, resourceType, resourceId, details, status }
 */
router.post('/', auditController.createLog);

/**
 * DELETE /api/audit/cleanup
 * Limpiar logs antiguos
 * Body: { daysOld } (minimo 90 dias)
 */
router.delete('/cleanup', auditController.cleanupOldLogs);

module.exports = router;
