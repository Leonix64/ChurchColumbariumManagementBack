const mongoose = require('mongoose');

/**
 * Modelo de SUCESIÓN
 * Registro explícito de cada evento de sucesión/transferencia de titularidad.
 * Permite rastrear la cadena completa de dueños de un nicho.
 */

const SuccessionSchema = new mongoose.Schema({
    // Nicho afectado
    niche: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Niche',
        required: true,
        index: true
    },

    // Dueño anterior
    previousCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },

    // Nuevo dueño
    newCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },

    // Beneficiario que heredó (null en transferencias manuales)
    beneficiary: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Beneficiary'
    },

    // Venta asociada
    sale: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale'
    },

    // Fecha de fallecimiento del titular anterior
    deceasedDate: {
        type: Date
    },

    // Registro de fallecido creado
    deceasedRecord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deceased'
    },

    // Tipo de sucesión
    type: {
        type: String,
        enum: ['succession', 'transfer', 'inheritance'],
        default: 'succession'
    },

    // Quién registró la sucesión
    registeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    reason: {
        type: String,
        trim: true
    },

    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    }
}, {
    timestamps: true,
    versionKey: false
});

// Índice para consultar historial de sucesiones de un nicho
SuccessionSchema.index({ niche: 1, createdAt: -1 });

module.exports = mongoose.model('Succession', SuccessionSchema);
