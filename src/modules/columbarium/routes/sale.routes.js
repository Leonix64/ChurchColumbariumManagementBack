const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');

// POST /api/sales - Crea nueva venta
router.post('/', authMiddleware.verifyToken,saleController.createSale);

module.exports = router;
