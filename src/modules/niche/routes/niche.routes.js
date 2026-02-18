const express = require('express');
const router = express.Router();
const nicheController = require('../controllers/niche.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');
const validateMongoId = require('../../../middlewares/validateMongoId');
const nicheValidator = require('../validators/niche.validator');

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

// Buscar nichos con paginacion
router.get('/search',
    nicheController.searchNiches
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

// Listar nichos deshabilitados (DEBE ir antes de /:id)
router.get('/disabled',
    authMiddleware.checkRole('admin', 'seller'),
    nicheController.getDisabledNiches
);

/**
 * GET /api/niches/:id
 * Obtener nicho por ID
 * Roles: todos los autenticados
 */
router.get('/:id',
    validateMongoId('id'),
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
    validateMongoId('id'),
    nicheValidator.validateUpdateNicheStatus,
    nicheController.updateNicheStatus
);

// Rutas de customización

// Cambiar material (individual)
router.patch('/:id/material',
    authMiddleware.checkRole('admin'),
    validateMongoId('id'),
    nicheController.changeMaterial
);

// Cambiar material (masivo)
router.post('/bulk-material',
    authMiddleware.checkRole('admin'),
    nicheController.bulkChangeMaterial
);

// Cambiar precio (individual)
router.patch('/:id/price',
    authMiddleware.checkRole('admin'),
    validateMongoId('id'),
    nicheController.changePrice
);

// Deshabilitar nichos
router.post('/:id/disable',
    authMiddleware.checkRole('admin'),
    nicheController.disableNiches
);

// Habilitar nichos
router.post('/enable',
    authMiddleware.checkRole('admin'),
    nicheController.enableNiches
);

// Crear nicho individual
router.post('/',
    authMiddleware.checkRole('admin'),
    nicheController.createNiche
);

module.exports = router;
