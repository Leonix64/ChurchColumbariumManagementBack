const express = require('express');
const router = express.Router();
const nicheController = require('../controllers/niche.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');

router.use(authMiddleware.verifyToken);

// GET /api/niches - Lista todos los nichos (con filtros)
router.get('/', nicheController.getAllNiches);

// GET /api/niches/code/:code - Busca nicho por codigo
router.get('/code/:code', nicheController.getNicheByCode);

// PATCH /api/niches/:id - Actualiza estado de nicho
router.patch('/:id', authMiddleware.checkRole('admin', 'seller'), // Solo admin y seller
    nicheController.updateNicheStatus);

module.exports = router;
