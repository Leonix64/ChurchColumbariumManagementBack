const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');

// POST /api/sales - Crea nueva venta
router.post('/', saleController.createSale);

module.exports = router;
