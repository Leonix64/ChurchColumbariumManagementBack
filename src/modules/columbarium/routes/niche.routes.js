const express = require('express');
const router = express.Router();
const nicheController = require('../controllers/niche.controller');

// GET /api/niches - Lista todos los nichos (con filtros)
router.get('/', nicheController.getAllNiches);

// GET /api/niches/code/:code - Busca nicho por codigo
router.get('/code/:code', nicheController.getNicheByCode);

// PATCH /api/niches/:id - Actualiza estado de nicho
router.patch('/:id', nicheController.updateNicheStatus);

module.exports = router;
