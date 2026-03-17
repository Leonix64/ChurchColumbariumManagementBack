/**
 * LOGGER SIMPLE
 * Sistema de logging condicional según el entorno
 * - info/warn/debug: Solo en desarrollo
 * - error: Siempre activo (producción y desarrollo)
 */

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Logger con niveles de severidad
 * Filtra logs automáticamente según el entorno
 * 
 * @property {Function} info - Logs informativos (solo desarrollo)
 * @property {Function} error - Logs de errores (siempre activo)
 * @property {Function} warn - Advertencias (solo desarrollo)
 * @property {Function} debug - Logs de depuración (solo desarrollo)
 */
const logger = {
    info: (...args) => isDev && console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args), // Siempre activo
    warn: (...args) => isDev && console.warn('[WARN]', ...args),
    debug: (...args) => isDev && console.log('[DEBUG]', ...args),
};

module.exports = logger;
