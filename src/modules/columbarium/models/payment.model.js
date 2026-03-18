const mongoose = require('mongoose');
const { toNumber } = require('../../../utils/decimal');

/**
 * PAGO
 * Registro de cada pago realizado: enganche, mensualidad o mantenimiento.
 * Los pagos de venta se vinculan a cuotas mediante PaymentScheduleLink.
 */
const PaymentSchema = new mongoose.Schema({
    // Relaciones
    sale: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Sale',
        required: false, // Opcional: mantenimiento no tiene venta asociada
        index: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Customer',
        required: false,
        index: true
    },
    niche: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Niche',
        required: false,
        index: true
    },
    registeredBy: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User',
        index: true
    },

    // Folio unico (ej: REC-00001)
    receiptNumber: {
        type: String,
        unique: true,
        required: [true, 'El numero de recibo es requerido']
    },

    // Monto total del pago (puede cubrir multiples cuotas)
    amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        validate: {
            validator: function (v) {
                return toNumber(v) > 0;
            },
            message: 'El monto debe ser mayor a 0'
        }
    },

    // Balance de la venta antes y despues del pago (solo para pagos de venta)
    balanceBefore: {
        type: mongoose.Schema.Types.Decimal128,
        required: false
    },
    balanceAfter: {
        type: mongoose.Schema.Types.Decimal128,
        required: false
    },

    concept: {
        type: String,
        enum: ['down_payment', 'monthly_payment', 'maintenance', 'extra'],
        required: true
    },

    method: {
        type: String,
        enum: ['cash', 'card', 'transfer'],
        default: 'cash',
        required: true
    },

    paymentDate: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Mantenimiento, a que año corresponde?
    maintenanceYear: {
        type: Number,
        required: function () {
            return this.concept === 'maintenance';
        }
    },

    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    },

    status: {
        type: String,
        enum: ['completed', 'cancelled', 'refunded'],
        default: 'completed'
    },

    cancellationInfo: {
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cancelledAt: Date,
        reason: String
    }
}, { timestamps: true, versionKey: false });

// Indices
PaymentSchema.index({ sale: 1, paymentDate: -1 });
PaymentSchema.index({ customer: 1, paymentDate: -1 });
PaymentSchema.index({ niche: 1, concept: 1, maintenanceYear: 1 }); // Para buscar mantenimientos
PaymentSchema.index({ status: 1, createdAt: -1 });

// Cancelar pago
PaymentSchema.methods.cancelPayment = function (userId, reason) {
    this.status = 'cancelled';
    this.cancellationInfo = {
        cancelledBy: userId,
        cancelledAt: new Date(),
        reason: reason || 'Sin especificar'
    };

    return this;
};

// Sale requerido solo para conceptos de venta
PaymentSchema.pre('validate', function () {
    const ventaConcepts = ['down_payment', 'monthly_payment', 'extra'];

    // Para pagos de venta: sale Y customer son requeridos
    if (ventaConcepts.includes(this.concept)) {
        if (!this.sale) {
            this.invalidate('sale', 'Sale es requerido para pagos de venta');
        }
        if (!this.customer) {
            this.invalidate('customer', 'Customer es requerido para pagos de venta');
        }
    }

    // Para mantenimiento: niche es requerido, sale NO debe estar
    if (this.concept === 'maintenance') {
        if (!this.niche) {
            this.invalidate('niche', 'Niche es requerido para pagos de mantenimiento');
        }
        if (this.sale) {
            this.sale = undefined;
        }
    }
});

// Asegurar que virtuals se incluyan en JSON y convertir Decimal128 -> Number
PaymentSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        if (ret.amount != null) ret.amount = toNumber(ret.amount);
        if (ret.balanceBefore != null) ret.balanceBefore = toNumber(ret.balanceBefore);
        if (ret.balanceAfter != null) ret.balanceAfter = toNumber(ret.balanceAfter);
        return ret;
    }
});
PaymentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payment', PaymentSchema);
