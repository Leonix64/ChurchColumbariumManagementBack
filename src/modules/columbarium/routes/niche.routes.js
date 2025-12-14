const express = require('express');
const router = express.Router();
const nicheController = require('../controllers/niche.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const columbariumValidator = require('../validators/columbarium.validator');

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

/**
 * GET /api/niches/stats
 * Obtener estadísticas de nichos
 * Roles: admin, seller
 */
router.get('/stats',
    authMiddleware.checkRole('admin', 'seller'),
    nicheController.getNicheStats
);

/**
 * GET /api/niches/available
 * Buscar nichos disponibles
 * Query params: type, module, section
 * Roles: todos los autenticados
 */
router.get('/available',
    nicheController.getAvailableNiches
);

/**
 * GET /api/niches/code/:code
 * Buscar nicho por código
 * Roles: todos los autenticados
 */
router.get('/code/:code',
    nicheController.getNicheByCode
);

/**
 * GET /api/niches/:id
 * Obtener nicho por ID
 * Roles: todos los autenticados
 */
router.get('/:id',
    columbariumValidator.validateMongoId('id'),
    nicheController.getNicheById
);

/**
 * GET /api/niches
 * Listar todos los nichos (con filtros)
 * Query params: module, section, status, type
 * Roles: todos los autenticados
 */
router.get('/',
    nicheController.getAllNiches
);

/**
 * PATCH /api/niches/:id
 * Actualizar estado de nicho
 * Roles: admin, seller
 */
router.patch('/:id',
    authMiddleware.checkRole('admin', 'seller'),
    columbariumValidator.validateMongoId('id'),
    columbariumValidator.validateUpdateNicheStatus,
    nicheController.updateNicheStatus
);

module.exports = router;
