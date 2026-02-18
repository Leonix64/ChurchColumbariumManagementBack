/**
 * Generador centralizado de folios y números de recibo
 * Reemplaza la generación inline duplicada en controllers
 */

function generateCode(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

module.exports = {
    generateSaleFolio: () => generateCode('VENTA'),
    generateBulkSaleFolio: () => generateCode('BULK'),
    generateReceiptNumber: () => generateCode('REC'),
    generateMaintenanceReceipt: () => generateCode('MANT'),
    generateRefundNumber: () => generateCode('REFUND')
};
