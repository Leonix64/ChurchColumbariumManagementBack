const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Rutas protegidas (requieren autenticación)
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.get('/profile', authMiddleware.verifyToken, authController.getProfile);
router.put('/profile', authMiddleware.verifyToken, authController.updateProfile);
router.post('/change-password', authMiddleware.verifyToken, authController.changePassword);
router.post('/invalidate-all', authMiddleware.verifyToken, authController.invalidateAllTokens);

// Rutas solo para admin
router.get('/admin/users',
    authMiddleware.verifyToken,
    authMiddleware.checkRole('admin'),
    (req, res) => {
        // Esto sería otro controller, por ahora placeholder
        res.json({ message: 'Lista de usuarios (solo admin)' });
    }
);

module.exports = router;