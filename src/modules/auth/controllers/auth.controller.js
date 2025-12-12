const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const config = require('../../../config/env');
const { errors, asyncHandler } = require('../../../middlewares/errorHandler');

const authController = {

    /**
     * REGISTRO DE NUEVO USUARIO
     * POST /api/auth/register
     * Solo usuarios admin pueden registrar nuevos usuarios
     */
    register: asyncHandler(async (req, res) => {
        const { username, email, password, fullName, phone, role } = req.body;

        // Verificar si usuario existe
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            const field = existingUser.username === username ? 'usuario' : 'email';
            throw errors.conflict(`El ${field} ya esta registrado`);
        }

        // Crear usuario (el middleware pre-save encriptara el password aqui ya no)
        const newUser = await User.create({
            username,
            email,
            password,
            fullName,
            phone: phone || '',
            role: role || 'seller',
            isActive: true
        });

        // Generar tokens
        const accessToken = newUser.generateAccessToken();
        const refreshToken = newUser.generateRefreshToken();

        // Guardar refresh token
        newUser.refreshToken = refreshToken;
        await newUser.save();

        // Preparar respuesta
        const userResponse = {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            fullName: newUser.fullName,
            role: newUser.role,
            createdAt: newUser.createdAt
        };

        return res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            data: {
                user: userResponse,
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: config.jwt.accessExpire
                }
            }
        });
    }),

    /**
     * LOGIN DE USUARIO
     * POST /api/auth/login
     */
    login: asyncHandler(async (req, res) => {
        const { username, password } = req.body;

        // Buscar usuario (incluyendo password y datos necesarios)
        const user = await User.findOne({
            $or: [{ username }, { email: username }]
        }).select('+password +refreshToken +loginAttempts +lockUntil');

        if (!user) {
            throw errors.unauthorized('Credenciales invalidas');
        }

        // Verificar si esta bloqueado
        if (user.isLocked) {
            throw errors.forbidden('Cuenta bloqueada por multiples intentos fallidos. Intenta en 2 horas');
        }

        // Verificar si esta bloqueado
        if (!user.isActive) {
            throw errors.forbidden('Cuenta desactivada. Contacta al administrador.');
        }

        // Verificar contraseña
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            // Incrementar intentos fallidos
            await user.incrementLoginAttempts();
            throw errors.unauthorized('Credenciales invalidas');
        }

        // Resetear intentos fallidos
        await user.resetLoginAttempts();

        // Actualizar ultimo login
        user.lastLogin = new Date();

        // Generar tokens
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Guardar refresh token
        user.refreshToken = refreshToken;
        await user.save();

        // Preparar respuesta
        const userResponse = {
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            lastLogin: user.lastLogin
        };

        // Configurar cookies (opcional)
        if (config.server.isProduction) {
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Login exitoso',
            data: {
                user: userResponse,
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: config.jwt.accessExpire
                }
            }
        });
    }),

    /**
     * RENOVAR TOKEN (Refresh Token)
     * POST /api/auth/refresh-token
     */
    refreshToken: asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;

        // Verificar refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
        } catch (error) {
            throw errors.unauthorized('Refresh token invalido o expirado');
        }

        // Buscar usuario
        const user = await User.findById(decoded.id).select('+refreshToken +tokenVersion');

        if (!user || !user.isActive) {
            throw errors.unauthorized('Usuario no encontrado o inactivo');
        }

        // Verificar token version
        if (decoded.tokenVersion !== user.tokenVersion) {
            throw errors.unauthorized('Refresh token invalido (versión)');
        }

        // Verificar que sea el refresh token actual
        if (user.refreshToken !== refreshToken) {
            throw errors.unauthorized('Refresh token invalido');
        }

        // Generar nuevos tokens
        const newAccessToken = user.generateAccessToken();
        const newRefreshToken = user.generateRefreshToken();

        // Actualizar refresh token en BD
        user.refreshToken = newRefreshToken;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Tokens renovados',
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: config.jwt.accessExpire
            }
        });

    }),

    /**
     * LOGOUT (Cerrar sesión)
     * POST /api/auth/logout
     * Invalida el refresh token actual
     */
    logout: asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw errors.badRequest('Refresh token es requerido');
        }

        try {
            const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

            // Elimina el refresh token de la DB
            await User.findByIdAndUpdate(decoded.id, {
                $unset: { refreshToken: 1 }
            });
        } catch (error) {
            // Si el token es invalido, igual permite cerrar sesion
        }

        // Limpiar cookies
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        return res.status(200).json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });
    }),

    /**
     * PERFIL DE USUARIO
     * GET /api/auth/profile
     */
    getProfile: asyncHandler(async (req, res) => {
        const user = await User.findById(req.user.id);

        if (!user) {
            throw errors.notFound('Usuario');
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    }),

    /**
     * ACTUALIZAR PERFIL
     * PUT /api/auth/profile
     */
    updateProfile: asyncHandler(async (req, res) => {
        const { fullName, phone } = req.body;
        const updates = {};

        if (fullName) updates.fullName = fullName;
        if (phone) updates.phone = phone;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            throw errors.notFound('Usuario');
        }

        return res.status(200).json({
            success: true,
            message: 'Perfil actualizado',
            data: updatedUser
        });
    }),

    /**
     * CAMBIAR CONTRASEÑA
     * POST /api/auth/change-password
     */
    changePassword: asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = req.body;

        // Obtener usuario con password
        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            throw errors.notFound('Usuario');
        }

        // Verificar contraseña actual
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);

        if (!isCurrentPasswordValid) {
            throw errors.unauthorized('Contraseña actual incorrecta');
        }

        // Actualizar contraseña (el pre-save la encriptara)
        user.password = newPassword;
        await user.save();

        // Invalidar todos los tokens (seguridad)
        await user.invalidateTokens();

        return res.status(200).json({
            success: true,
            message: 'Contraseña cambiada exitosamente. Todos los dispositivos fueron desconectados por seguridad.'
        });
    }),

    /**
     * INVALIDAR TODOS LOS TOKENS
     * POST /api/auth/invalidate-all
     * Aumenta tokenVersion, invalidando todos los tokens existentes
     */
    invalidateAllTokens: asyncHandler(async (req, res) => {
        const { userId } = req.body;
        const requestingUser = req.user; // Del middleware de auth

        // Solo admin puede invalidar tokens de otros usuarios
        if (userId && userId !== requestingUser.id && requestingUser.role !== 'admin') {
            throw errors.forbidden('No tienes permiso para invalidar tokens de otros usuarios');
        }

        const targetUserId = userId || requestingUser.id;
        const user = await User.findById(targetUserId);

        if (!user) {
            throw errors.notFound('Usuario');
        }

        // Incrementar tokenVersion (invalida todos los tokens)
        await user.invalidateTokens();

        return res.status(200).json({
            success: true,
            message: 'Todos los tokens invalidados. El usuario debera iniciar sesion nuevamente.'
        });
    })
};

module.exports = authController;