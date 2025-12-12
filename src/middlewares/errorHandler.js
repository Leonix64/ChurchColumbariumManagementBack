/**
 * MANEJO DE ERRORES CENTRALIZADO
 * Captura todos los errores y los formatea
 */

const config = require('../config/env');

// Clase personalizada para errores de API
class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Errores comunes predefinidos
const errors = {
    // Autenticacion
    unauthorized: (message = 'No autorizado') =>
        new ApiError(401, message),

    forbidden: (message = 'Acceso denegado') =>
        new ApiError(403, message),

    tokenExpired: () =>
        new ApiError(401, 'Token expirado', { code: 'TOKEN_EXPIRED' }),

    // Validacion
    badRequest: (message = 'Peticion invalida', details = null) =>
        new ApiError(400, message, details),

    notFound: (resource = 'Recurso') =>
        new ApiError(404, `${resource} no encontrado`),

    // Conflictos
    conflict: (message = 'El recurso ya existe') =>
        new ApiError(409, message),

    // Server
    internal: (message = 'Error interno del servidor') =>
        new ApiError(500, message)
};

// Manejo de errores
const errorHandler = (err, req, res, next) => {
    let { statusCode = 500, message } = err;

    // Errores de Mongoose
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Error de validacion';
        const details = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        return res.status(statusCode).json({
            message,
            details
        });
    }

    // Duplicado (codigo 11000)
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern)[0];
        message = `El ${field} ya existe`;
        return res.status(statusCode).json({
            success: false,
            message
        });
    }

    // CastError (ID invalido)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = 'ID invalido';
        return res.status(statusCode).json({
            success: false,
            message
        });
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token invalido'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expirado',
            code: 'TOKEN_EXPIRED'
        });
    }

    // Log del error (solo en desarrollo)
    if (config.server.isDevelopment) {
        console.error('Error:', err);
    }

    // Respuesta generica
    return res.status(statusCode).json({
        success: false,
        message,
        ...(err.details && { details: err.details }),
        ...(config.server.isDevelopment && { stack: err.stack })
    });
};

// Rutas no encontradas
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado',
        path: req.originalPath,
        method: req.method
    });
};

// Wrapper para async functions (Atrapa errores automáticamente)
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    ApiError,
    errors,
    errorHandler,
    notFoundHandler,
    asyncHandler
};