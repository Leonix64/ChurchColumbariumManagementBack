const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// POST /api/customers - Crea un nuevo cliente
router.post('/', customerController.createCustomer);

// GET /api/customers - Lista clientes (con busqueda)
router.get('/', customerController.getCustomers);

module.exports = router;
