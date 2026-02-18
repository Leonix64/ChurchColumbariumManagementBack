/**
 * Validadores de Niche
 */

const { errors } = require('../../../middlewares/errorHandler');

const nicheValidator = {
    /**
     * Validar actualización de estado de nicho
     */
    validateUpdateNicheStatus: (req, res, next) => {
        const { status } = req.body;
        const validationErrors = [];

        if (status && !['available', 'reserved', 'sold'].includes(status)) {
            validationErrors.push({
                field: 'status',
                message: 'Estado invalido. Debe ser: available, reserved o sold'
            });
        }

        if (validationErrors.length > 0) {
            return next(errors.badRequest('Errores de validacion', validationErrors));
        }

        next();
    }
};

module.exports = nicheValidator;
