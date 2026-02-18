const mongoose = require('mongoose');

/**
 * Modelo de BENEFICIARIO (Colección independiente)
 *
 * Los beneficiarios están ligados a un NICHO, no a un Customer.
 * Esto permite que sobrevivan a sucesiones y cambios de titularidad.
 *
 * Flujo:
 * 1. Se crean al hacer una venta (ligados al nicho y al customer que los designó)
 * 2. En sucesión, el beneficiario que hereda se marca isActive=false
 * 3. Los restantes se re-asignan al nuevo dueño (designatedBy se actualiza)
 * 4. El nuevo dueño puede agregar/modificar beneficiarios
 */

const BeneficiaryModel = new mongoose.Schema({
    // Datos de la persona
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

    // A qué nicho está ligado este beneficiario
    niche: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Niche',
        required: [true, 'El nicho es requerido'],
        index: true
    },

    // Quién lo designó como beneficiario
    designatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'El cliente que designa es requerido'],
        index: true
    },

    // Prioridad en la cadena de sucesión
    order: {
        type: Number,
        required: [true, 'El orden es requerido'],
        min: [1, 'El orden debe ser mayor a 0']
    },

    // Estado
    isActive: {
        type: Boolean,
        default: true
    },
    isDeceased: {
        type: Boolean,
        default: false
    },
    deceasedDate: {
        type: Date
    },

    // Si este beneficiario heredó el nicho
    becameOwnerAt: {
        type: Date
    },

    // Vínculo con registro Customer (si esta persona ya tiene uno)
    linkedCustomer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        index: true
    },

    // Razón de desactivación
    inactivationReason: {
        type: String,
        enum: ['inherited', 'deceased', 'removed', 'reassigned']
    },

    notes: {
        type: String,
        trim: true,
        maxlength: [200, 'Las notas no pueden tener más de 200 caracteres']
    }
}, {
    timestamps: true,
    versionKey: false
});

// Índice compuesto para buscar beneficiarios activos de un nicho, ordenados por prioridad
BeneficiaryModel.index({ niche: 1, isActive: 1, order: 1 });

// Índice para buscar beneficiarios por quien los designó
BeneficiaryModel.index({ designatedBy: 1, isActive: 1 });

module.exports = mongoose.model('Beneficiary', BeneficiaryModel);
