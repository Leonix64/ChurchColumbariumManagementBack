const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const authValidator = require('../validators/auth.validator');

// Rutas públicas
router.post('/register', authValidator.validateRegister, authController.register);
router.post('/login', authValidator.validateLogin, authController.login);
router.post('/refresh-token', authValidator.validateRefreshToken, authController.refreshToken);

// Rutas protegidas (requieren autenticación)
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.get('/profile', authMiddleware.verifyToken, authController.getProfile);
router.put('/profile', authMiddleware.verifyToken, authController.updateProfile);
router.post('/change-password', authMiddleware.verifyToken, authValidator.validateChangePassword, authController.changePassword);
router.post('/invalidate-all', authMiddleware.verifyToken, authController.invalidateAllTokens);

// Rutas solo para admin
router.get('/admin/users',
    authMiddleware.verifyToken,
    authMiddleware.checkRole('admin'),
    authController.getAllUsers
);

module.exports = router;
