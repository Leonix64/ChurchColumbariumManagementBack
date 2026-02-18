/**
 * Validadores de Customer
 */

const { errors } = require('../../../middlewares/errorHandler');

const customerValidator = {
    /**
     * Validar creación de cliente
     */
    validateCreateCustomer: (req, res, next) => {
        const { firstName, lastName, phone, email, rfc } = req.body;
        const validationErrors = [];

        // Nombre
        if (!firstName) {
            validationErrors.push({
                field: 'firstName',
                message: 'El nombre es requerido'
            });
        } else if (firstName.length < 2) {
            validationErrors.push({
                field: 'firstName',
                message: 'El nombre debe tener al menos 2 caracteres'
            });
        }

        // Apellido
        if (!lastName) {
            validationErrors.push({
                field: 'lastName',
                message: 'El apellido es requerido'
            });
        } else if (lastName.length < 2) {
            validationErrors.push({
                field: 'lastName',
                message: 'El apellido debe tener al menos 2 caracteres'
            });
        }

        // Telefono
        if (!phone) {
            validationErrors.push({
                field: 'phone',
                message: 'El telefono es requerido'
            });
        } else if (!/^[0-9]{10}$/.test(phone)) {
            validationErrors.push({
                field: 'phone',
                message: 'Telefono inválido (debe tener 10 digitos)'
            });
        }

        // Email (opcional pero si viene debe ser válido)
        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            validationErrors.push({
                field: 'email',
                message: 'Email invalido'
            });
        }

        // RFC (opcional pero si viene debe ser válido)
        if (rfc && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc.toUpperCase())) {
            validationErrors.push({
                field: 'rfc',
                message: 'RFC invalido'
            });
        }

        if (validationErrors.length > 0) {
            return next(errors.badRequest('Errores de validacion', validationErrors));
        }

        next();
    }
};

module.exports = customerValidator;
