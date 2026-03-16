const mongoose = require('mongoose');

/**
 * DIFUNTO
 * Persona cuyas cenizas están depositadas en un nicho.
 * Un nicho puede tener varios ocupantes (array en Niche.occupants).
 * Registra fechas importantes y relación con el propietario.
 */

const DeceasedSchema = new mongoose.Schema({
    niche: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Niche',
        required: [true, 'El nicho es requerido']
    },

    // Datos personales
    fullName: { type: String, required: true },
    dateOfBirth: Date,
    dateOfDeath: Date,
    dateOfInterment: Date,

    relationshipToOwner: {
        type: String,
        enum: [
            'padre', 'madre', 'hijo', 'hija', 'esposo', 'esposa',
            'abuelo', 'abuela', 'tio', 'tia', 'primo', 'prima',
            'amigo', 'otro'
        ],
        default: 'otro'
    }
}, { timestamps: true });

DeceasedSchema.index({ niche: 1 });
DeceasedSchema.index({ fullName: 'text' });

module.exports = mongoose.model('Deceased', DeceasedSchema);
