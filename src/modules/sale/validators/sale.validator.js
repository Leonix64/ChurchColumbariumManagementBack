/**
 * Validadores de Sale
 */

const mongoose = require('mongoose');
const { errors } = require('../../../middlewares/errorHandler');

const saleValidator = {
    /**
     * Validar creación de venta
     */
    validateCreateSale: (req, res, next) => {
        const { nicheId, customerId, totalAmount, downPayment } = req.body;
        const validationErrors = [];

        // Nicho ID
        if (!nicheId) {
            validationErrors.push({
                field: 'nicheId',
                message: 'El ID del nicho es requerido'
            });
        } else if (!mongoose.Types.ObjectId.isValid(nicheId)) {
            validationErrors.push({
                field: 'nicheId',
                message: 'ID de nicho invalido'
            });
        }

        // Cliente ID
        if (!customerId) {
            validationErrors.push({
                field: 'customerId',
                message: 'El ID del cliente es requerido'
            });
        } else if (!mongoose.Types.ObjectId.isValid(customerId)) {
            validationErrors.push({
                field: 'customerId',
                message: 'ID de cliente invalido'
            });
        }

        // Total Amount
        if (!totalAmount) {
            validationErrors.push({
                field: 'totalAmount',
                message: 'El monto total es requerido'
            });
        } else if (isNaN(totalAmount) || totalAmount <= 0) {
            validationErrors.push({
                field: 'totalAmount',
                message: 'El monto total debe ser mayor a 0'
            });
        }

        // Down Payment
        if (!downPayment) {
            validationErrors.push({
                field: 'downPayment',
                message: 'El enganche es requerido'
            });
        } else if (isNaN(downPayment) || downPayment <= 0) {
            validationErrors.push({
                field: 'downPayment',
                message: 'El enganche debe ser mayor a 0'
            });
        } else if (totalAmount && downPayment >= totalAmount) {
            validationErrors.push({
                field: 'downPayment',
                message: 'El enganche debe ser menor al total'
            });
        }

        if (validationErrors.length > 0) {
            return next(errors.badRequest('Errores de validación', validationErrors));
        }

        next();
    }
};

module.exports = saleValidator;
