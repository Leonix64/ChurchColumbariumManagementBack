const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../../auth/middlewares/auth.middleware');

// POST /api/customers - Crea un nuevo cliente
router.post('/', authMiddleware.verifyToken,customerController.createCustomer);

// GET /api/customers - Lista clientes (con busqueda)
router.get('/', authMiddleware.verifyToken,customerController.getCustomers);

module.exports = router;
