const mongoose = require('mongoose');
const { toNumber } = require('../../../utils/decimal');

/**
 * Modelo de BENEFICIARIO
 * Persona designada para heredar el nicho en caso de fallecimiento del titular.
 * Colección propia — referencia al Niche (no embebido en Customer).
 */

const BeneficiarySchema = new mongoose.Schema({
    niche: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Niche',
        required: [true, 'El nicho es requerido'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true,
        minlength: 3,
        maxlength: 100
    },
    relationship: {
        type: String,
        required: [true, 'La relación es requerida'],
        trim: true,
        enum: [
            'esposo', 'esposa', 'hijo', 'hija',
            'padre', 'madre', 'hermano', 'hermana',
            'abuelo', 'abuela', 'nieto', 'nieta',
            'tio', 'tia', 'sobrino', 'sobrina',
            'primo', 'prima', 'yerno', 'nuera',
            'cuñado', 'cuñada', 'otro'
        ]
    },
    phone: {
        type: String,
        match: /^[0-9]{10}$/
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    dateOfBirth: Date,
    isDeceased: {
        type: Boolean,
        default: false,
        index: true
    },
    deceasedDate: Date,
    order: {
        type: Number,
        required: [true, 'El orden es requerido'],
        min: 1,
        index: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 200
    }
}, { timestamps: true });

// Unicidad: no puede haber dos beneficiarios con el mismo orden en el mismo nicho
BeneficiarySchema.index({ niche: 1, order: 1 }, { unique: true });

// Consulta frecuente: beneficiarios vivos de un nicho
BeneficiarySchema.index({ niche: 1, isDeceased: 1 });

module.exports = mongoose.model('Beneficiary', BeneficiarySchema);
