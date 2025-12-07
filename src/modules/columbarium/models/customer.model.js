const mongoose = require('mongoose');

/**
 * Modelo de CLIENTE
 * Persona que compra/reserva un nicho
 */

const CustomerSchema = new mongoose.Schema({
    // Datos personales
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    rfc: { type: String }, // Opcional, para facturación
    address: { type: String },

    // Contacto de emergencia
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },

    // Personas que usaran el nicho
    beneficiaries: [{ type: String }],

    // Estado del cliente
    active: { type: Boolean, default: true }
}, { timestamps: true });

// Indice para busquedas rapidas
CustomerSchema.index({
    firstName: 'text',
    lastName: 'text',
    rfc: 'text',
});

module.exports = mongoose.model('Customer', CustomerSchema);
