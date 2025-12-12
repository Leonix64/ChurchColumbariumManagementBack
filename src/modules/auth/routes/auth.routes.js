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
    async (req, res) => {
        try {
            const User = require('../models/user.model');
            const users = await User.find({}).select('-password -refreshToken');

            res.json({
                success: true,
                count: users.length,
                data: users
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener usuarios'
            });
        }
    }
);

module.exports = router;