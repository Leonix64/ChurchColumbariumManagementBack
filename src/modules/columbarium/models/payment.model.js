const mongoose = require('mongoose');

/**
 * Modelo de PAGO
 * Registra cada pago realizado (enganche, mensualidad, mantenimiento, etc.)
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

    // Folio consecutivo unico (ej: REC-00001)
    receiptNumber: {
        type: String,
        unique: true,
        required: [true, 'El numero de recibo es requerido']
    },

    // Monto total del pago (puede cubrir multiples cuotas)
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

    // Balance de la venta antes y despues del pago (solo para pagos de venta)
    balanceBefore: {
        type: Number,
        required: false
    },
    balanceAfter: {
        type: Number,
        required: false
    },

    // Concepto del pago
    concept: {
        type: String,
        enum: ['down_payment', 'monthly_payment', 'maintenance', 'extra'],
        required: true
    },

    // Metodo de pago
    method: {
        type: String,
        enum: ['cash', 'card', 'transfer'],
        default: 'cash',
        required: true
    },

    // Fecha de pago
    paymentDate: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Si es mantenimiento, a que año corresponde?
    maintenanceYear: {
        type: Number,
        required: function () {
            return this.concept === 'maintenance';
        }
    },

    // Notas del pago
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    },

    //Estado del pago
    status: {
        type: String,
        enum: ['completed', 'cancelled', 'refunded'],
        default: 'completed'
    },

    // Info de cancelacion (si aplica)
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
PaymentSchema.index({ receiptNumber: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

// Virtual: Numero de cuotas cubiertas
PaymentSchema.virtual('paymentsCovered').get(function () {
    return this.appliedTo ? this.appliedTo.length : 0;
});

// Metodo: Cancelar pago
PaymentSchema.methods.cancelPayment = function (userId, reason) {
    this.status = 'cancelled';
    this.cancellationInfo = {
        cancelledBy: userId,
        cancelledAt: new Date(),
        reason: reason || 'Sin especificar'
    };

    return this;
};

// Validación condicional: sale requerido solo para conceptos de venta
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
        // Customer se auto-completa del propietario actual del nicho
    }
});

// Asegurar que virtuals se incluyan en JSON
PaymentSchema.set('toJSON', { virtuals: true });
PaymentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payment', PaymentSchema);