const mongoose = require('mongoose');
const { toNumber } = require('../../../utils/decimal');

/**
 * VÍNCULO PAGO <-> CUOTA
 * Tabla pivot N:M entre Payment y AmortSchedule.
 * Registra cuánto de cada pago se aplicó a cada cuota.
 */

const PaymentScheduleLinkSchema = new mongoose.Schema({
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: [true, 'El pago es requerido'],
        index: true
    },

    amortEntry: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AmortSchedule',
        required: [true, 'La cuota es requerida'],
        index: true
    },

    appliedAmount: {
        type: mongoose.Schema.Types.Decimal128,
        required: [true, 'El monto aplicado es requerido']
    },

    paidOn: {
        type: Date,
        required: [true, 'La fecha de pago es requerida']
    }
}, {
    timestamps: true,
    versionKey: false,
    collection: 'paymentschedulelinks'
});

// Índices
PaymentScheduleLinkSchema.index({ payment: 1, amortEntry: 1 }, { unique: true });

// Convertir Decimal128 -> Number en JSON
PaymentScheduleLinkSchema.set('toJSON', {
    transform: function (doc, ret) {
        if (ret.appliedAmount != null) ret.appliedAmount = toNumber(ret.appliedAmount);
        return ret;
    }
});

module.exports = mongoose.model('PaymentScheduleLink', PaymentScheduleLinkSchema);
