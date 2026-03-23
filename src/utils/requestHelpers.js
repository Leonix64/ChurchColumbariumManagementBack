/**
 * Helpers para extraer datos comunes del objeto request de Express.
 * Evita duplicar la construcción del contexto de usuario en cada controlador.
 */

/**
 * Construye el contexto de usuario desde el request.
 * Usado para auditoría, tracking de quién realizó cada acción
 * y para pasar a la capa de servicios sin exponer el objeto req completo.
 *
 * @param {import('express').Request} req - Express request object
 * @returns {{ id, username, role, ip, userAgent }} User context object
 */
function buildUserContext(req) {
    return {
        id: req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        ip: req.ip,
        userAgent: req.get('user-agent')
    };
}

module.exports = {
    buildUserContext
};
