const mongoose = require('mongoose');
const { toNumber } = require('../../../utils/decimal');

/**
 * BENEFICIARIO
 * Persona designada para heredar el nicho si el titular fallece.
 * Coleccion independiente referenciada al nicho.
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
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform(doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

// Unicidad
BeneficiarySchema.index({ niche: 1, order: 1 }, { unique: true });

BeneficiarySchema.index({ niche: 1, isDeceased: 1 });

module.exports = mongoose.model('Beneficiary', BeneficiarySchema);
