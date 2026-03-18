const mongoose = require('mongoose');

/**
 * CLIENTE
 * Persona que compra o reserva un nicho.
 * Puede ser propietario actual o heredero.
 */
const CustomerSchema = new mongoose.Schema({
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

    // Opcional, para facturación
    rfc: {
        type: String,
        uppercase: true,
        trim: true,
        minlength: [12, 'RFC debe tener 12 o 13 caracteres'],
        maxlength: [13, 'RFC debe tener 12 o 13 caracteres'],
        match: [/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/, 'RFC invalido']
    },

    address: {
        type: String,
        trim: true,
        maxlength: [200, 'La dirección no puede tener más de 200 caracteres']
    },

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

    // Trazabilidad de sucesión
    createdBySuccession: {
        type: Boolean,
        default: false,
        index: true
    },
    successionDate: {
        type: Date
    },

    // Estado del cliente
    active: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indice
CustomerSchema.index({
    firstName: 'text',
    lastName: 'text',
    rfc: 'text',
});

// Índices
CustomerSchema.index({ firstName: 1, lastName: 1 });
CustomerSchema.index({ active: 1, createdAt: -1 });


// Obtener nombre completo
CustomerSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

CustomerSchema.set('toJSON', { virtuals: true });
CustomerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', CustomerSchema);
