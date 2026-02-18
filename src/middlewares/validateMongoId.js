/**
 * Middleware para validar IDs de MongoDB
 * Compartido entre todos los módulos
 */

const mongoose = require('mongoose');
const { errors } = require('./errorHandler');

const validateMongoId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(errors.badRequest(`ID invalido: ${id}`));
        }

        next();
    };
};

module.exports = validateMongoId;
