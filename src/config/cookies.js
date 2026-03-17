const config = require('./env');

/**
 * Genera opciones de cookies según el entorno
 * En producción: requiere HTTPS (secure: true)
 * En desarrollo: permite HTTP (secure: false)
 */
const getCookieOptions = (maxAge) => {
    const baseOptions = {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: maxAge,
    };

    // En produccion: require HTTPS
    if (config.server.isProduction) {
        return {
            ...baseOptions,
            secure: true, // Solo HTTPS
            domain: process.env.COOKIE_DOMAIN || undefined,
        };
    }

    // En desarrollo: permite HTTP y HTTPS
    return {
        ...baseOptions,
        secure: false  // Permite HTTP (localhost)
    };
};

/**
 * Opciones predefinidas para diferentes tipos de cookies
 * - refreshToken: 7 días
 * - accessToken: 15 minutos
 * - session: 24 horas
 */
const cookieOptions = {
    // Refresh Token (7 dias)
    refreshToken: getCookieOptions(7 * 24 * 60 * 60 * 1000),

    // Access Token (15 minutos)
    accessToken: getCookieOptions(15 * 60 * 1000),

    // Session (24 horas)
    session: getCookieOptions(24 * 60 * 60 * 1000),
};

/**
 * Establece una cookie de manera segura
 * @param {Object} res - Response de Express
 * @param {string} name - Nombre de la cookie
 * @param {string} value - Valor de la cookie
 * @param {string} type - Tipo: 'refreshToken' | 'accessToken' | 'session'
 */
const setSecureCookie = (res, name, value, type = 'refreshToken') => {
    const options = cookieOptions[type];

    if (!options) {
        throw new Error(`Tipo de cookie invalido: ${type}`);
    }
    res.cookie(name, value, options);
};

/**
 * Elimina una cookie de manera segura
 * Usa las mismas opciones que al crearla para asegurar eliminación correcta
 */
const clearSecureCookie = (res, name) => {
    res.clearCookie(name, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: config.server.isProduction,
    });
};

/**
 * Elimina todas las cookies de autenticación
 * Útil para logout completo
 */
const clearAuthCookies = (res) => {
    clearSecureCookie(res, 'refreshToken');
    clearSecureCookie(res, 'accessToken');
};

module.exports = {
    cookieOptions,
    getCookieOptions,
    setSecureCookie,
    clearSecureCookie,
    clearAuthCookies
};
