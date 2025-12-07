const mongoose = require('mongoose');

/**
 * Modelo de PAGO
 * Registra cada pago realizado (enganche, mensualidad, etc.)
 */

const PaymentSchema = new mongoose.Schema({
    // Relaciones
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    // Folio consecutivo unico (ej: REC-00001)
    receiptNumber: {
        type: String,
        unique: true,
        required: [true, 'El número de recibo es requerido']
    },

    // Detalles del pago
    amount: {
        type: Number,
        required: true,
        min: [1, 'El monto debe ser mayor a 0'],
        validate: {
            validator: function (v) {
                return v > 0;
            },
            message: props => `${props.value} no es un monto válido`
        }
    },
    concept: {
        type: String,
        enum: ['down_payment', 'monthly_payment', 'maintenance', 'extra'],
        required: true
    },
    method: { type: String, enum: ['cash', 'card', 'transfer'], default: 'cash' },
    paymentDate: { type: Date, default: Date.now },

    // Si es mantenimiento, a que año corresponde?
    maintenanceYear: { type: Number },

    notes: String
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
