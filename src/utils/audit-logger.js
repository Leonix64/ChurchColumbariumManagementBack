/**
 * Helper centralizado para crear logs de auditoría
 * Elimina la duplicación del patrón de Audit.create en cada controller
 */

const Audit = require('../modules/audit/models/audit.model');

/**
 * Crea un log de auditoría
 * @param {Object} params
 * @param {Object} params.user - req.user (id, username, role)
 * @param {string} params.action - Acción realizada
 * @param {string} params.module - Módulo del sistema
 * @param {string} params.resourceType - Tipo de recurso afectado
 * @param {string|ObjectId} params.resourceId - ID del recurso afectado
 * @param {Object} params.details - Detalles específicos de la acción
 * @param {Object} params.req - Request object (para ip y userAgent)
 * @param {string} [params.status='success'] - Estado del log
 * @param {string} [params.errorMessage] - Mensaje de error si aplica
 * @param {Object} [params.session] - Mongoose session para transacciones
 */
async function createAuditLog({ user, action, module, resourceType, resourceId, details, req, status = 'success', errorMessage, session }) {
    const auditData = {
        user: user?.id,
        username: user?.username,
        userRole: user?.role,
        action,
        module,
        resourceType,
        resourceId,
        details,
        status,
        errorMessage,
        ip: req?.ip,
        userAgent: req?.get?.('user-agent')
    };

    if (session) {
        return Audit.create([auditData], { session });
    }

    return Audit.create(auditData);
}

module.exports = { createAuditLog };
