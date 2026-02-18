const express = require('express');
const router = express.Router();
const beneficiaryController = require('../controllers/beneficiary.controller');
const { verifyToken, checkRole } = require('../../auth/middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener beneficiarios de un nicho
router.get('/niche/:nicheId', beneficiaryController.getByNiche);

// Obtener próximo beneficiario activo de un nicho
router.get('/niche/:nicheId/next', beneficiaryController.getNextForNiche);

// Obtener beneficiarios designados por un customer
router.get('/customer/:customerId', beneficiaryController.getByCustomer);

// Actualizar beneficiarios de un nicho (admin, seller)
router.put('/niche/:nicheId', checkRole('admin', 'seller'), beneficiaryController.updateByNiche);

// Marcar beneficiario como fallecido (admin, seller)
router.post('/:id/deceased', checkRole('admin', 'seller'), beneficiaryController.markDeceased);

module.exports = router;
