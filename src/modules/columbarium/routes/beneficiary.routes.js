const router = require('express').Router();
const { verifyToken, checkRole } = require('../../auth/middlewares/auth.middleware');
const ctrl = require('../controllers/beneficiary.controller');
const { ROLES } = require('../../../config/constants');

/**
 * GET /api/beneficiaries/niche/:nicheId
 * Listar beneficiarios de un nicho
 * Roles: todos los autenticados
 */
router.get('/niche/:nicheId',
    verifyToken,
    ctrl.getByNiche
);

/**
 * GET /api/beneficiaries/niche/:nicheId/next
 * Obtener siguiente beneficiario vivo (orden de sucesión)
 * Roles: todos los autenticados
 */
router.get('/niche/:nicheId/next',
    verifyToken,
    ctrl.getNextBeneficiary
);

/**
 * POST /api/beneficiaries/niche/:nicheId
 * Crear beneficiario para un nicho
 * Roles: admin, seller
 * Body: { name, relationship, phone, email, dateOfBirth, order, notes }
 */
router.post('/niche/:nicheId',
    verifyToken,
    checkRole(ROLES.ADMIN, ROLES.SELLER),
    ctrl.create
);

/**
 * PUT /api/beneficiaries/niche/:nicheId/bulk
 * Reemplazar todos los beneficiarios de un nicho
 * Roles: admin, seller
 * Body: { beneficiaries: [{ name, relationship, phone, email, order }] }
 * Requiere mínimo 3 beneficiarios
 */
router.put('/niche/:nicheId/bulk',
    verifyToken,
    checkRole(ROLES.ADMIN, ROLES.SELLER),
    ctrl.bulkUpdate
);

/**
 * PUT /api/beneficiaries/:id
 * Actualizar datos de un beneficiario
 * Roles: admin, seller
 */
router.put('/:id',
    verifyToken,
    checkRole(ROLES.ADMIN, ROLES.SELLER),
    ctrl.update
);

/**
 * POST /api/beneficiaries/:id/deceased
 * Marcar beneficiario como fallecido
 * Roles: admin, seller
 * Body: { deceasedDate, notes }
 */
router.post('/:id/deceased',
    verifyToken,
    checkRole(ROLES.ADMIN, ROLES.SELLER),
    ctrl.markDeceased
);

module.exports = router;
