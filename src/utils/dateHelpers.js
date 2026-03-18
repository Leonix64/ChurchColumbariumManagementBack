/**
 * Helpers de fecha con manejo explícito de UTC.
 * Evita bugs de DST (horario de verano) al usar métodos getUTC*setUTC* en vez
 * de los métodos locales (getMonth/setMonth/etc.) que dependen del timezone del servidor.
 *
 * Regla de uso:
 *   - `new Date()` en lógica de negocio  → nowUTC()
 *   - Comparar "mismo día"               → startOfDayUTC() / endOfDayUTC()
 *   - Sumar meses                        → addMonthsUTC()
 *   - Último día del mes (amortización)  → lastDayOfMonthUTC()
 */

/**
 * Retorna la fecha/hora actual.
 * Equivalente a `new Date()` pero deja explícita la intención UTC en el código.
 * @returns {Date}
 */
function nowUTC() {
    return new Date();
}

/**
 * Convierte una fecha al inicio del día en UTC (00:00:00.000).
 * @param {Date|string} date
 * @returns {Date}
 */
function startOfDayUTC(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Convierte una fecha al final del día en UTC (23:59:59.999).
 * Útil para filtros de rango de fecha inclusivos.
 * @param {Date|string} date
 * @returns {Date}
 */
function endOfDayUTC(date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

/**
 * Agrega N meses a una fecha usando métodos UTC (evita desbordamientos de DST).
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addMonthsUTC(date, months) {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
}

/**
 * Retorna el último día del mes que resulta de avanzar `monthsToAdd` meses
 * desde `startDate`. Diseñado para generar fechas de vencimiento de cuotas.
 *
 * Ejemplo:
 *   lastDayOfMonthUTC(new Date('2024-03-15'), 1) → 2024-04-30T23:59:59.999Z
 *   lastDayOfMonthUTC(new Date('2024-01-31'), 1) → 2024-02-29T23:59:59.999Z (leap year)
 *
 * Funciona con desbordamientos de año: diciembre + 1 → enero del año siguiente.
 *
 * @param {Date} startDate  - Fecha base
 * @param {number} monthsToAdd - Meses a avanzar (>= 1)
 * @returns {Date} - Último día del mes resultante, a las 23:59:59.999 UTC
 */
function lastDayOfMonthUTC(startDate, monthsToAdd) {
    // Date.UTC(year, month+1, 0) da el último día del mes `month` de forma segura,
    // incluso cuando month > 11 (desbordamiento manejado automáticamente por el motor JS).
    return new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + monthsToAdd + 1,
        0,           // día 0 = último día del mes anterior
        23, 59, 59, 999
    ));
}

module.exports = {
    nowUTC,
    startOfDayUTC,
    endOfDayUTC,
    addMonthsUTC,
    lastDayOfMonthUTC,
};
