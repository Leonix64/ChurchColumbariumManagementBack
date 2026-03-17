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
 * GET /api/niches/search
 * Buscar nichos con paginación
 * Query params: search, type, limit, page
 */
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

/**
 * GET /api/niches/disabled
 * Listar nichos deshabilitados
 * Roles: admin, seller
 * NOTA: Debe ir antes de /:id para evitar conflicto de rutas
 */
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

/**
 * PATCH /api/niches/:id/material
 * Cambiar tipo de material del nicho
 * Roles: solo admin
 * Body: { type: 'wood' | 'marble' | 'special', price: number }
 */
router.patch('/:id/material',
    authMiddleware.checkRole('admin'),
    columbariumValidator.validateMongoId('id'),
    nicheController.changeMaterial
);

// Cambiar precio (individual)
router.patch('/:id/price',
    authMiddleware.checkRole('admin'),
    columbariumValidator.validateMongoId('id'),
    nicheController.changePrice
);

// Deshabilitar nicho
router.post('/:id/disable',
    authMiddleware.checkRole('admin'),
    columbariumValidator.validateMongoId('id'),
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
