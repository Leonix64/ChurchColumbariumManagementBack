const mongoose = require('mongoose');

/**
 * Modelo de DIFUNTO
 * Personas cuyas cenizas estan depositadas en un nicho
 */

const DeceasedSchema = new mongoose.Schema({
    // Nicho donde esta depositado (null si no se internó en un nicho)
    niche: { type: mongoose.Schema.Types.ObjectId, ref: 'Niche' },

    // Datos personales
    fullName: { type: String, required: true },
    dateOfBirth: Date,
    dateOfDeath: Date,
    dateOfInterment: Date, // Fecha en que deposito la urna

    // Relacion con el propietario del nicho
    relationshipToOwner: {
        type: String,
        enum: [
            'padre', 'madre', 'hijo', 'hija', 'esposo', 'esposa',
            'abuelo', 'abuela', 'tio', 'tia', 'primo', 'prima',
            'amigo', 'titular', 'otro'
        ],
        default: 'otro'
    },

    // Si esta persona era titular/customer de un nicho
    wasCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    },

    // Si su fallecimiento provocó una sucesión
    causeOfSuccession: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Deceased', DeceasedSchema);
