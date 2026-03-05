const mongoose = require('mongoose');

/**
 * HELPERS PARA Decimal128
 * Mongoose almacena valores Decimal128 como objetos, no como primitivos JS.
 * Las operaciones aritméticas (+, -, *, /) y comparaciones (>, <, ===)
 * deben pasar por estas funciones para evitar resultados incorrectos.
 */

/**
 * Convierte un valor Decimal128 (o Number/String) a número JS para operar.
 * @param {*} value
 * @returns {number}
 */
function toNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return parseFloat(value.toString());
}

/**
 * Convierte un número o string a Decimal128 para guardar en MongoDB.
 * @param {number|string|null|undefined} value
 * @returns {mongoose.Types.Decimal128}
 */
function toDecimal(value) {
    if (value === null || value === undefined) {
        return mongoose.Types.Decimal128.fromString('0');
    }
    return mongoose.Types.Decimal128.fromString(
        String(parseFloat(value) || 0)
    );
}

/**
 * Compara si un valor Decimal128 (o Number) es estrictamente mayor que cero.
 * @param {*} value
 * @returns {boolean}
 */
function isPositive(value) {
    return toNumber(value) > 0;
}

/**
 * Compara si dos valores Decimal128 (o Number) son iguales.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function isEqual(a, b) {
    return toNumber(a) === toNumber(b);
}

module.exports = { toNumber, toDecimal, isPositive, isEqual };
