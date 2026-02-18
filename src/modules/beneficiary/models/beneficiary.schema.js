const mongoose = require('mongoose');

/**
 * Schema reutilizable de Beneficiario
 * Se usa tanto en Customer (registro original) como en Niche (donde viven los beneficiarios activos)
 */
const BeneficiarySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre del beneficiario es requerido'],
        trim: true,
        minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
        maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
    },
    relationship: {
        type: String,
        required: [true, 'La relación es requerida'],
        enum: [
            'esposo', 'esposa', 'hijo', 'hija', 'padre', 'madre',
            'hermano', 'hermana', 'abuelo', 'abuela', 'nieto', 'nieta',
            'tio', 'tia', 'sobrino', 'sobrina', 'primo', 'prima',
            'yerno', 'nuera', 'cuñado', 'cuñada', 'otro'
        ],
        trim: true
    },
    phone: {
        type: String,
        trim: true,
        match: [/^[0-9]{10}$/, 'Teléfono inválido (10 dígitos)']
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },
    dateOfBirth: {
        type: Date
    },
    isDeceased: {
        type: Boolean,
        default: false
    },
    deceasedDate: {
        type: Date
    },
    order: {
        type: Number,
        required: [true, 'El orden es requerido'],
        min: [1, 'El orden debe ser mayor a 0']
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [200, 'Las notas no pueden tener más de 200 caracteres']
    }
}, { _id: true, timestamps: false });

module.exports = BeneficiarySchema;
