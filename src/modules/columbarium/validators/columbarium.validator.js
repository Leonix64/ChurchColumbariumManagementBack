/**
 * VALIDADORES DE COLUMBARIUM
 * Valida datos de entrada antes de procesarlos
 */

const { errors } = require('../../../middlewares/errorHandler');
const mongoose = require('mongoose');

const columbariumValidator = {

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
    },

    /**
     * Validar actualizacion de estado de nicho
     */
    validateUpdateNicheStatus: (req, res, next) => {
        const { status } = req.body;
        const validationErrors = [];

        // Status
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
    },

    /**
     * Validar creacion de venta
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
    },

    /**
     * Validar ID de MongoDB
     */
    validateMongoId: (paramName = 'id') => {
        return (req, res, next) => {
            const id = req.params[paramName];

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return next(errors.badRequest(`ID invalido: ${id}`));
            }

            next();
        };
    }
};

module.exports = columbariumValidator;
