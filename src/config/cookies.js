const config = require('./env');

// Obtiene opciones de cookies segun el entorno
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

// Opciones predefinidas para diferentes tipos de cookies
const cookieOptions = {
    // Refresh Token (7 dias)
    refreshToken: getCookieOptions(7 * 24 * 60 * 60 * 1000),

    // Access Token (15 minutos)
    accessToken: getCookieOptions(15 * 60 * 1000),

    // Session (24 horas)
    session: getCookieOptions(24 * 60 * 60 * 1000),
};

// Configura cookies de manera segura
const setSecureCookie = (res, name, value, type = 'refreshToken') => {
    const options = cookieOptions[type];

    if (!options) {
        throw new Error(`Tipo de cookie invalido: ${type}`);
    }
    res.cookie(name, value, options);
};

// Limpia una cookie de manera segura
const clearSecureCookie = (res, name) => {
    res.clearCookie(name, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: config.server.isProduction,
    });
};

// limpia todas las cookies de autenticacion
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
