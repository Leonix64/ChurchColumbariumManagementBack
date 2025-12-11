const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Tiempos de expiración (puedes moverlos a .env)
const ACCESS_TOKEN_EXPIRE = process.env.JWT_ACCESS_EXPIRE || '15m';
const REFRESH_TOKEN_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

const authController = {

    /**
     * 🔐 REGISTRO DE NUEVO USUARIO
     * POST /api/auth/register
     * Solo usuarios admin pueden registrar nuevos usuarios
     */
    // En auth.controller.js - Modifica el método register:

    register: async (req, res) => {
        try {
            const { username, email, password, fullName, phone, role } = req.body;

            // Validaciones
            if (!username || !email || !password || !fullName) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos'
                });
            }

            // Verificar si usuario existe
            const existingUser = await User.findOne({
                $or: [{ username }, { email }]
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: existingUser.username === username
                        ? 'El nombre de usuario ya existe'
                        : 'El email ya está registrado'
                });
            }

            // Encriptar password
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Crear usuario
            const newUser = await User.create({
                username,
                email,
                password: hashedPassword,
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
                message: '✅ Usuario registrado exitosamente',
                data: {
                    user: userResponse,
                    tokens: {
                        accessToken,
                        refreshToken,
                        accessTokenExpire: process.env.JWT_ACCESS_EXPIRE || '15m',
                        refreshTokenExpire: process.env.JWT_REFRESH_EXPIRE || '7d'
                    }
                }
            });

        } catch (error) {
            console.error('Error en registro:', error);

            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'El usuario o email ya existen'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Error al registrar usuario',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * 🔑 LOGIN DE USUARIO
     * POST /api/auth/login
     */
    // En auth.controller.js - login method:
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Usuario y contraseña son requeridos'
                });
            }

            // Buscar usuario (incluyendo password)
            const user = await User.findOne({
                $or: [{ username }, { email: username }]
            }).select('+password +refreshToken');

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Verificar si está activo
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Cuenta desactivada'
                });
            }

            // Verificar contraseña con bcrypt
            const bcrypt = require('bcryptjs');
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Actualizar último login
            user.lastLogin = new Date();
            await user.save();

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

            return res.status(200).json({
                success: true,
                message: '✅ Login exitoso',
                data: {
                    user: userResponse,
                    tokens: {
                        accessToken,
                        refreshToken,
                        accessTokenExpire: process.env.JWT_ACCESS_EXPIRE || '15m',
                        refreshTokenExpire: process.env.JWT_REFRESH_EXPIRE || '7d'
                    }
                }
            });

        } catch (error) {
            console.error('Error en login:', error);
            return res.status(500).json({
                success: false,
                message: 'Error en el proceso de login'
            });
        }
    },

    /**
     * 🔄 RENOVAR TOKEN (Refresh Token)
     * POST /api/auth/refresh-token
     */
    refreshToken: async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token es requerido'
                });
            }

            // Verificar refresh token
            let decoded;
            try {
                decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token inválido o expirado'
                });
            }

            // Buscar usuario
            const user = await User.findById(decoded.id).select('+refreshToken +tokenVersion');

            if (!user || !user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no encontrado o inactivo'
                });
            }

            // Verificar que el token version coincida
            if (decoded.tokenVersion !== user.tokenVersion) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token inválido (versión)'
                });
            }

            // Verificar que el refresh token sea el actual
            if (user.refreshToken !== refreshToken) {
                return res.status(401).json({
                    success: false,
                    message: 'Refresh token inválido'
                });
            }

            // Generar nuevos tokens
            const newAccessToken = user.generateAccessToken();
            const newRefreshToken = user.generateRefreshToken();

            // Actualizar refresh token en BD
            user.refreshToken = newRefreshToken;
            await user.save();

            // Configurar cookies (opcional)
            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            res.cookie('accessToken', newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000
            });

            return res.status(200).json({
                success: true,
                message: '✅ Tokens renovados',
                data: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    accessTokenExpire: ACCESS_TOKEN_EXPIRE,
                    refreshTokenExpire: REFRESH_TOKEN_EXPIRE
                }
            });

        } catch (error) {
            console.error('Error en refresh token:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al renovar tokens',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * 🚪 LOGOUT (Cerrar sesión)
     * POST /api/auth/logout
     * Invalida el refresh token actual
     */
    logout: async (req, res) => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token es requerido'
                });
            }

            // Verificar token
            let decoded;
            try {
                decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            } catch (error) {
                // Si el token es inválido, igual limpiamos cookies
                res.clearCookie('accessToken');
                res.clearCookie('refreshToken');
                return res.status(200).json({
                    success: true,
                    message: 'Sesión cerrada'
                });
            }

            // Buscar usuario y limpiar refresh token
            await User.findByIdAndUpdate(decoded.id, {
                $unset: { refreshToken: 1 }
            });

            // Limpiar cookies
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');

            return res.status(200).json({
                success: true,
                message: '✅ Sesión cerrada exitosamente'
            });

        } catch (error) {
            console.error('Error en logout:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al cerrar sesión'
            });
        }
    },

    /**
     * 🔄 INVALIDAR TODOS LOS TOKENS
     * POST /api/auth/invalidate-all
     * Aumenta tokenVersion, invalidando todos los tokens existentes
     */
    invalidateAllTokens: async (req, res) => {
        try {
            const { userId } = req.body;
            const requestingUser = req.user; // Del middleware de auth

            // Solo admin puede invalidar tokens de otros usuarios
            if (userId && userId !== requestingUser.id && requestingUser.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para invalidar tokens de otros usuarios'
                });
            }

            const targetUserId = userId || requestingUser.id;
            const user = await User.findById(targetUserId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Incrementar tokenVersion (invalida todos los tokens)
            await user.invalidateTokens();

            return res.status(200).json({
                success: true,
                message: '✅ Todos los tokens han sido invalidados. El usuario deberá iniciar sesión nuevamente.'
            });

        } catch (error) {
            console.error('Error al invalidar tokens:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al invalidar tokens'
            });
        }
    },

    /**
     * 👤 PERFIL DE USUARIO
     * GET /api/auth/profile
     */
    getProfile: async (req, res) => {
        try {
            const user = await User.findById(req.user.id)
                .select('-password -refreshToken -__v');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            return res.status(200).json({
                success: true,
                data: user
            });

        } catch (error) {
            console.error('Error al obtener perfil:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener perfil'
            });
        }
    },

    /**
     * ✏️ ACTUALIZAR PERFIL
     * PUT /api/auth/profile
     */
    updateProfile: async (req, res) => {
        try {
            const { fullName, phone } = req.body;
            const userId = req.user.id;

            const updates = {};
            if (fullName) updates.fullName = fullName;
            if (phone) updates.phone = phone;

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                updates,
                { new: true, runValidators: true }
            ).select('-password -refreshToken -__v');

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            return res.status(200).json({
                success: true,
                message: '✅ Perfil actualizado',
                data: updatedUser
            });

        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar perfil'
            });
        }
    },

    /**
     * 🔑 CAMBIAR CONTRASEÑA
     * POST /api/auth/change-password
     */
    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'La contraseña actual y la nueva son requeridas'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'La nueva contraseña debe tener al menos 6 caracteres'
                });
            }

            // Obtener usuario con password
            const user = await User.findById(userId).select('+password');

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // Verificar contraseña actual
            const isCurrentPasswordValid = await user.comparePassword(currentPassword);

            if (!isCurrentPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Contraseña actual incorrecta'
                });
            }

            // Actualizar contraseña (el pre-save middleware la encriptará)
            user.password = newPassword;
            await user.save();

            // Invalidar todos los tokens existentes (seguridad)
            await user.invalidateTokens();

            return res.status(200).json({
                success: true,
                message: '✅ Contraseña cambiada exitosamente. Todos los dispositivos serán desconectados por seguridad.'
            });

        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al cambiar contraseña'
            });
        }
    }
};

module.exports = authController;