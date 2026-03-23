const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const authValidator = require('../validators/auth.validator');
const { authLimiter } = require('../../../config/rateLimiters');
const { ROLES } = require('../../../config/constants');

// Rutas públicas
router.post('/login', authLimiter, authValidator.validateLogin, authController.login);
router.post('/refresh-token', authLimiter, authValidator.validateRefreshToken, authController.refreshToken);

// Registro de usuarios — solo admin puede crear cuentas
router.post('/register',
    authMiddleware.verifyToken,
    authMiddleware.checkRole(ROLES.ADMIN),
    authValidator.validateRegister,
    authController.register
);

// Rutas protegidas (requieren autenticación)
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.get('/profile', authMiddleware.verifyToken, authController.getProfile);
router.put('/profile', authMiddleware.verifyToken, authController.updateProfile);
router.post('/change-password', authMiddleware.verifyToken, authValidator.validateChangePassword, authController.changePassword);
router.post('/invalidate-all', authMiddleware.verifyToken, authController.invalidateAllTokens);

// Rutas solo para admin
router.get('/admin/users',
    authMiddleware.verifyToken,
    authMiddleware.checkRole(ROLES.ADMIN),
    authController.getAllUsers
);

module.exports = router;
