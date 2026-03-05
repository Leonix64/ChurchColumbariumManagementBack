const router = require('express').Router();
const { verifyToken, checkRole } = require('../../auth/middlewares/auth.middleware');
const ctrl = require('../controllers/beneficiary.controller');

// Lectura — cualquier usuario autenticado
router.get('/niche/:nicheId',
    verifyToken,
    ctrl.getByNiche
);

router.get('/niche/:nicheId/next',
    verifyToken,
    ctrl.getNextBeneficiary
);

// Escritura — admin y seller
router.post('/niche/:nicheId',
    verifyToken,
    checkRole('admin', 'seller'),
    ctrl.create
);

router.put('/niche/:nicheId/bulk',
    verifyToken,
    checkRole('admin', 'seller'),
    ctrl.bulkUpdate
);

router.put('/:id',
    verifyToken,
    checkRole('admin', 'seller'),
    ctrl.update
);

router.post('/:id/deceased',
    verifyToken,
    checkRole('admin', 'seller'),
    ctrl.markDeceased
);

module.exports = router;
