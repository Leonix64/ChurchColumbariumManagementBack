const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../../../config/env');

const authMiddleware = {

    /**
     * VERIFICAR TOKEN DE ACCESO
     */
    verifyToken: async (req, res, next) => {
        try {
            // Obtener token del header o cookie
            let token = req.headers.authorization || req.cookies.accessToken;

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'Acceso denegado. Token no proporcionado.'
                });
            }

            // Extraer token de "Bearer <token>"
            if (token.startsWith('Bearer ')) {
                token = token.slice(7, token.length).trim();
            }

            // Verificar token
            let decoded;
            try {
                decoded = jwt.verify(token, config.jwt.accessSecret);
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        success: false,
                        message: 'Token expirado. Por favor, renueva tu token.',
                        code: 'TOKEN_EXPIRED'
                    });
                }
                return res.status(401).json({
                    success: false,
                    message: 'Token invalido'
                });
            }

            // Verificar que el usuario existe y esta activo
            const user = await User.findById(decoded.id)
                .select('+tokenVersion +isActive');

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Cuenta desactivada'
                });
            }

            // Verificar token version (para invalidacion global)
            if (decoded.tokenVersion !== user.tokenVersion) {
                return res.status(401).json({
                    success: false,
                    message: 'Token invalido. Por favor, inicia sesion nuevamente.',
                    code: 'TOKEN_VERSION_MISMATCH'
                });
            }

            // Agregar usuario a la request
            req.user = {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                tokenVersion: user.tokenVersion
            };

            next();

        } catch (error) {
            console.error('Error en verifyToken:', error);
            return res.status(500).json({
                success: false,
                message: 'Error en autenticacion'
            });
        }
    },

    /**
     * VERIFICAR ROL (Autorizacion)
     */
    checkRole: (...allowedRoles) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
            }

            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: `Acceso denegado. Se requieren los roles: ${allowedRoles.join(', ')}`
                });
            }

            next();
        };
    },

    /**
     * VERIFICAR SI ES EL MISMO USUARIO O ADMIN
     * Para operaciones que solo el dueño o admin puede hacer
     */
    checkOwnerOrAdmin: (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }

        const { id } = req.params; // ID del recurso a modificar

        // Si es admin, permitir siempre
        if (req.user.role === 'admin') {
            return next();
        }

        // Si el ID del recurso coincide con el ID del usuario, permitir
        if (id && id === req.user.id) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Solo puedes modificar tu propia información o ser administrador'
        });
    }
};

module.exports = authMiddleware;
