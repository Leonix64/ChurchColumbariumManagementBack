/**
 * Constantes del sistema ChurchSystem
 * Centraliza magic numbers para facilitar mantenimiento y testing.
 * NO incluir valores que vengan de variables de entorno (.env) — esos van en config/env.js.
 */
module.exports = {

    // Amortización y finanzas
    AMORTIZATION: {
        DEFAULT_MONTHS: 18,          // Plazo por defecto para ventas a crédito
        DEFAULT_INTEREST_RATE: 0,    // Tasa de interés (0% actualmente)
        MIN_DOWN_PAYMENT_PERCENT: 0, // Porcentaje mínimo de enganche
    },

    // Autenticación y seguridad
    AUTH: {
        MAX_LOGIN_ATTEMPTS: 5,               // Intentos fallidos antes de bloqueo
        LOCK_TIME_MS: 2 * 60 * 60 * 1000,   // 2 horas en milisegundos
        LOCK_TIME_HOURS: 2,                  // 2 horas (legible para logs/mensajes)
        JWT_EXPIRES_IN: '15m',               // Duración del access token
        REFRESH_EXPIRES_IN: '7d',            // Duración del refresh token
    },

    // Paginación
    PAGINATION: {
        AUDIT_MAX_LIMIT: 200,        // Límite máximo de resultados en audit (previene DoS)
        AUDIT_ALL_DEFAULT: 100,      // Default para getAllLogs
        AUDIT_DEFAULT_LIMIT: 50,     // Default para getUserHistory
        AUDIT_RECENT_DEFAULT: 20,    // Default para getRecentActivity
        DEFAULT_PAGE_SIZE: 10,       // Tamaño de página genérico
    },

    // Audit logs
    AUDIT: {
        TTL_DAYS: 365,               // Tiempo de vida de logs (1 año, TTL index en Mongo)
        MIN_CLEANUP_DAYS: 90,        // Mínimo de días para borrado manual
    },

    // Enums de status (para referencia y validación)
    STATUS: {
        NICHE: ['available', 'reserved', 'sold', 'disabled'],
        SALE: ['active', 'paid', 'cancelled', 'overdue'],
        PAYMENT: ['completed', 'cancelled', 'refunded'],
        AMORT_ENTRY: ['pending', 'partial', 'paid', 'paid_late', 'overdue'],
    },

    // Roles de usuario del sistema
    ROLES: {
        ADMIN: 'admin',
        SELLER: 'seller',
        VIEWER: 'viewer',
        ALL: ['admin', 'seller', 'viewer'],
    },

    // Estados de los registros de auditoría
    AUDIT_STATUS: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        ALL: ['success', 'error', 'warning'],
    },
};
