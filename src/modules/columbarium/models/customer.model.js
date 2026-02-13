const mongoose = require('mongoose');
const BeneficiarySchema = require('./beneficiary.schema');

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

    // Personas que usaran el nicho
    beneficiaries: {
        type: [BeneficiarySchema],
        validate: {
            validator: function (v) {
                return v && v.length >= 3;
            },
            message: 'Debe haber al menos 3 beneficiarios registrados'
        }
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

// Indice para busquedas rapidas
CustomerSchema.index({
    firstName: 'text',
    lastName: 'text',
    rfc: 'text',
});

// Índices compuestos para búsquedas
CustomerSchema.index({ firstName: 1, lastName: 1 });
CustomerSchema.index({ active: 1, createdAt: -1 });


// Método para obtener el próximo beneficiario vivo (ordenado por prioridad)
CustomerSchema.methods.getNextBeneficiary = function () {
    if (!this.beneficiaries || this.beneficiaries.length === 0) {
        return null;
    }

    const livingBeneficiaries = this.beneficiaries
        .filter(b => !b.isDeceased)
        .sort((a, b) => a.order - b.order);

    return livingBeneficiaries.length > 0 ? livingBeneficiaries[0] : null;
};

// Método para obtener nombre completo
CustomerSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Asegurar que virtuals se incluyan en JSON
CustomerSchema.set('toJSON', { virtuals: true });
CustomerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', CustomerSchema);
