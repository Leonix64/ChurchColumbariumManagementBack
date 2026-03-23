const mongoose = require('mongoose');
const { toNumber } = require('../../../utils/decimal');

/**
 * REEMBOLSO
 * Devolución de dinero por cancelación de venta.
 * Registra monto, método, razón y usuario autorizante.
 */
const RefundSchema = new mongoose.Schema({
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

    refundedBy: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User',
        required: true,
        index: true
    },

    receiptNumber: {
        type: String,
        unique: true,
        required: [true, 'El numero de recibo de reembolso es requerido']
    },

    amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        validate: {
            validator: function (v) { return toNumber(v) >= 0; },
            message: 'El monto no puede ser negativo'
        }
    },

    method: {
        type: String,
        enum: ['cash', 'card', 'transfer'],
        default: 'cash',
        required: true
    },

    reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'La razon no puede tener más de 500 caracteres']
    },

    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    },

    refundDate: {
        type: Date,
        default: Date.now,
        index: true
    },

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
// receiptNumber no necesita schema.index() — ya tiene unique:true en la definición del campo
RefundSchema.index({ status: 1, createdAt: -1 });

// Convertir Decimal128 -> Number en JSON
RefundSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.amount != null) ret.amount = toNumber(ret.amount);
        return ret;
    }
});

module.exports = mongoose.model('Refund', RefundSchema);
