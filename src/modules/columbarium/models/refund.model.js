const mongoose = require('mongoose');

/**
 * Modelo de REEMBOLSO (NUEVO)
 * Para registrar devoluciones de dinero por cancelaciones
 */

const RefundSchema = new mongoose.Schema({
    // Relaciones
    sale: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Sale',
        required: true,
        index: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Customer',
        required: true,
        index: true
    },

    // Usuario que autorizo el reembolso
    refundedBy: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User',
        required: true,
        index: true
    },

    // Folio unico del reembolso
    receiptNumber: {
        type: String,
        unique: true,
        required: [true, 'El numero de recibo de reembolso es requerido']
    },

    // Monto del reembolso
    amount: {
        type: Number,
        required: true,
        min: [0, 'El monto del reembolso no puede ser negativo']
    },

    // Metodo de devolucion
    method: {
        type: String,
        enum: ['cash', 'card', 'transfer'],
        default: 'cash',
        required: true
    },

    // Razon del reembolso
    reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'La razon no puede tener más de 500 caracteres']
    },

    // Notas adicionales
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    },

    // Fecha del reembolso
    refundDate: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Estado del reembolso
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'completed'
    }

}, {
    timestamps: true,
    versionKey: false
});

// Indices
RefundSchema.index({ sale: 1, refundDate: -1 });
RefundSchema.index({ customer: 1, refundDate: -1 });
RefundSchema.index({ receiptNumber: 1 });
RefundSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Refund', RefundSchema);
