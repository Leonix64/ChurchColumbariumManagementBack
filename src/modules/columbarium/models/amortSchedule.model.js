const mongoose = require('mongoose');
const { toNumber } = require('../../../utils/decimal');

/**
 * CUOTA DE AMORTIZACIÓN
 * Cada cuota mensual de una venta (1-18).
 * Reemplaza el subdocument embebido en Sale.
 */

const AmortScheduleSchema = new mongoose.Schema({
    sale: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sale',
        required: [true, 'La venta es requerida'],
        index: true
    },

    number: {
        type: Number,
        required: [true, 'El número de cuota es requerido']
    },

    dueDate: {
        type: Date,
        required: [true, 'La fecha de vencimiento es requerida'],
        index: true
    },

    amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: [true, 'El monto es requerido']
    },

    // Total pagado aplicado a esta cuota
    amountPaid: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0')
    },

    amountRemaining: {
        type: mongoose.Schema.Types.Decimal128,
        required: [true, 'El monto restante es requerido']
    },

    status: {
        type: String,
        enum: {
            values: ['pending', 'partial', 'paid', 'paid_late', 'overdue'],
            message: 'Estado invalido. Debe ser: pending, partial, paid, paid_late o overdue'
        },
        default: 'pending',
        required: true,
        index: true
    }
}, {
    timestamps: true,
    versionKey: false,
    collection: 'amortschedules'
});

// Índices
AmortScheduleSchema.index({ sale: 1, number: 1 }, { unique: true });
AmortScheduleSchema.index({ dueDate: 1, status: 1 });
AmortScheduleSchema.index({ status: 1, dueDate: 1 });

// Convertir Decimal128 -> Number en JSON
AmortScheduleSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.amount != null) ret.amount = toNumber(ret.amount);
        if (ret.amountPaid != null) ret.amountPaid = toNumber(ret.amountPaid);
        if (ret.amountRemaining != null) ret.amountRemaining = toNumber(ret.amountRemaining);
        return ret;
    }
});

module.exports = mongoose.model('AmortSchedule', AmortScheduleSchema);
