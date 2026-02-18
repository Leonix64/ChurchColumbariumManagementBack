const mongoose = require('mongoose');
const BeneficiarySchema = require('../../beneficiary/models/beneficiary.schema');

/**
 * Modelo de CLIENTE
 * Persona que compra/reserva un nicho
 */

const CustomerSchema = new mongoose.Schema({
    // Datos personales
    firstName: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true,
        minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
        maxlength: [50, 'El nombre no puede tener más de 50 caracteres']
    },
    lastName: {
        type: String,
        required: [true, 'El apellido es requerido'],
        trim: true,
        minlength: [2, 'El apellido debe tener al menos 2 caracteres'],
        maxlength: [50, 'El apellido no puede tener más de 50 caracteres']
    },
    phone: {
        type: String,
        required: [true, 'El telefono es requerido'],
        match: [/^[0-9]{10}$/, 'Telefono inválido (10 digitos)']
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email invalido']
    },
    rfc: {
        type: String,
        uppercase: true,
        trim: true,
        unique: true,
        sparse: true, // Permite múltiples null/undefined
        minlength: [12, 'RFC debe tener 12 o 13 caracteres'],
        maxlength: [13, 'RFC debe tener 12 o 13 caracteres'],
        match: [/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/, 'RFC invalido']
    }, // Opcional, para facturación
    address: {
        type: String,
        trim: true,
        maxlength: [200, 'La dirección no puede tener más de 200 caracteres']
    },

    // Contacto de emergencia
    emergencyContact: {
        name: {
            type: String,
            trim: true
        },
        phone: {
            type: String,
            trim: true,
            match: [/^[0-9]{10}$/, 'Telefono de emergencia invalido']
        },
        relationship: {
            type: String,
            trim: true
        }
    },

    // Beneficiarios embebidos (legacy, se mantiene por compatibilidad)
    // Los beneficiarios activos viven en la colección independiente Beneficiary, ligados al Niche
    beneficiaries: {
        type: [BeneficiarySchema],
        default: []
    },

    // Estado del cliente
    status: {
        type: String,
        enum: ['active', 'inactive', 'deceased'],
        default: 'active',
        index: true
    },

    // Datos de fallecimiento (solo si status === 'deceased')
    deceasedDate: {
        type: Date
    },
    deceasedRecordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deceased'
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indice para busquedas rapidas
CustomerSchema.index({
    firstName: 'text',
    lastName: 'text',
    rfc: 'text',
});

// Índices compuestos para búsquedas
CustomerSchema.index({ firstName: 1, lastName: 1 });
CustomerSchema.index({ status: 1, createdAt: -1 });


// Virtual 'active' para compatibilidad con código existente
CustomerSchema.virtual('active')
    .get(function () {
        return this.status === 'active';
    })
    .set(function (val) {
        this.status = val ? 'active' : 'inactive';
    });

// Método para obtener nombre completo
CustomerSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Asegurar que virtuals se incluyan en JSON
CustomerSchema.set('toJSON', { virtuals: true });
CustomerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', CustomerSchema);
