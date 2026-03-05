/**
 * Genera un folio único con prefijo personalizable
 * Ejemplo: VTA-LK3M9X2T-AB4C
 */
function generateFolio(prefix = 'VTA') {
    const ts   = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
}

/**
 * Genera un número de recibo único
 * Alias de generateFolio con prefijo REC
 */
function generateReceiptNumber(prefix = 'REC') {
    return generateFolio(prefix);
}

/**
 * Formatea una respuesta paginada de forma consistente
 */
function paginatedResponse(data, total, page, limit) {
    return {
        data,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
    };
}

module.exports = { generateFolio, generateReceiptNumber, paginatedResponse };
