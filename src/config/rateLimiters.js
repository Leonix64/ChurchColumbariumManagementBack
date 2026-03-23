const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: {
        success: false,
        message: 'Demasiadas solicitudes, intenta más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // solo 10 intentos de login cada 15min
    message: {
        success: false,
        message: 'Demasiados intentos, intenta más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { generalLimiter, authLimiter };
