const mongoose = require('mongoose');

/**
 * Modelo de SUCESIÓN DE TITULARIDAD
 * Registra cada transferencia de propietario en un nicho.
 * Reemplaza la lectura de Niche.ownershipHistory[] para el historial.
 */

const SuccessionSchema = new mongoose.Schema({
    niche: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Niche',
        required: [true, 'El nicho es requerido'],
        index: true
    },

    sale: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',
        required: [true, 'La venta es requerida']
    },

    previousOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'El propietario anterior es requerido']
    },

    newOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'El nuevo propietario es requerido']
    },

    // El difunto que causó la sucesión (opcional, aplica en type:'death')
    deceased: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deceased'
    },

    registeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'El usuario registrador es requerido']
    },

    type: {
        type: String,
        required: [true, 'El tipo de sucesión es requerido'],
        enum: {
            values: ['death', 'transfer', 'manual'],
            message: 'Tipo invalido. Debe ser: death, transfer o manual'
        },
        default: 'death'
    },

    // Texto libre: "Fallecimiento del titular", etc.
    reason: {
        type: String,
        required: [true, 'El motivo es requerido'],
        trim: true
    },

    transferDate: {
        type: Date,
        required: [true, 'La fecha de transferencia es requerida'],
        default: Date.now
    },

    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    versionKey: false,
    collection: 'successions'
});

// Índices compuestos
SuccessionSchema.index({ niche: 1, transferDate: -1 });
SuccessionSchema.index({ previousOwner: 1 });
SuccessionSchema.index({ newOwner: 1 });

module.exports = mongoose.model('Succession', SuccessionSchema);
