const mongoose = require('mongoose');

/**
 * Modelo de VENTA
 * Registra la compra de un nicho con credito a 18 meses
 */

const SaleSchema = new mongoose.Schema({
    // Nicho vendido
    niche: { type: mongoose.Schema.Types.ObjectId, ref: 'Niche', required: true },

    /**
     * @deprecated Usar currentCustomer para el dueño actual y originalCustomer para el comprador original.
     * Se mantiene por compatibilidad con queries existentes (getSalesByCustomer).
     */
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    // Comprador original (NUNCA cambia, incluso en sucesión)
    originalCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    // Dueño actual (cambia en sucesión)
    currentCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

    // Usuario que registro la venta
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

    // Folio unico de la venta
    folio: { type: String, unique: true },

    // Montos financieros
    totalAmount: {
        type: Number,
        required: true,
        min: [1, 'El total debe ser mayor a 0']
    },
    downPayment: {
        type: Number,
        required: true,
        min: [1, 'El enganche debe ser mayor a 0'],
        validate: {
            validator: function (v) {
                return v < this.totalAmount;
            },
            message: 'El enganche debe ser menor al total'
        }
    },

    // El enganche inicial dinamico
    balance: {
        type: Number,
        required: true,
        min: [0, 'El saldo no puede ser negativo']
    },

    // Total pagado hasta el momento
    totalPaid: {
        type: Number,
        default: 0,
        min: [0, 'El total pagado no puede ser negativo']
    },

    // Terminos del credito
    monthsToPay: { type: Number, default: 18 },
    interestRate: { type: Number, default: 0 }, // Tasa de interes anual

    // Estado del contrato
    status: {
        type: String,
        enum: ['active', 'paid', 'cancelled', 'overdue'],
        default: 'active',
        index: true
    },

    // Informacion de cancelacion
    cancellationInfo: {
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cancelledAt: Date,
        reason: String,
        refundAmount: Number,
        refundMethod: { type: String, enum: ['cash', 'card', 'transfer'] },
        refundNotes: String
    },

    /** Tabla de AMORTIZACION 
     * Generada automaticamente al crear la venta
     * Incluye tracking detallado de pagos
    */
    amortizationTable: [{
        number: Number,
        dueDate: Date,
        amount: {
            type: Number,
            required: true,
            min: [1, 'El monto de la cuota debe ser mayor a 0']
        },

        // Tracking de pagos
        amountPaid: {
            type: Number,
            default: 0,
            min: [0, 'El monto pagado no puede ser negativo']
        },
        amountRemaining: {
            type: Number,
            default: function () {
                return this.amount;
            }
        },

        // Estado de la cuota
        status: {
            type: String,
            enum: ['pending', 'partial', 'paid', 'overdue'],
            default: 'pending'
        },

        // Array de pagos aplicados a esta cuota
        payments: [{
            paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
            appliedAmount: Number,
            paidOn: Date
        }],

        // LEGACY: Mantener compatibilidad
        paymentReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' } // Se llena al pagar
    }],

    // Historial de sucesiones en esta venta
    successionHistory: [{
        date: { type: Date, required: true },
        fromCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
        toCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
        reason: { type: String, default: 'succession' },
        registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],

    // Notas adicionales
    notes: String
}, { timestamps: true, versionKey: false });

// Indices
SaleSchema.index({ customer: 1, status: 1 });
SaleSchema.index({ originalCustomer: 1 });
SaleSchema.index({ currentCustomer: 1, status: 1 });
// folio already has unique:true in schema, no need for separate index
SaleSchema.index({ status: 1, createdAt: -1 });
SaleSchema.index({ 'amortizationTable.dueDate': 1, 'amortizationTable.status': 1 });

// Virtual: Progreso de pagos (%)
SaleSchema.virtual('paymentProgress').get(function () {
    if (!this.totalAmount || this.totalAmount === 0) return 0;
    return Math.round((this.totalPaid / this.totalAmount) * 100);
});

// Virtual: Numero de pagos completados
SaleSchema.virtual('paidPaymentsCount').get(function () {
    return this.amortizationTable.filter(p => p.status === 'paid').length;
});

// Virtual: Numero de pagos vencidos
SaleSchema.virtual('overduePaymentsCount').get(function () {
    return this.amortizationTable.filter(p => p.status === 'overdue').length;
});

// Metodo: Aplicar pago a la tabla de amortizacion
SaleSchema.methods.applyPayment = function (paymentId, totalAmount, appliedDistribution) {
    let remainingAmount = totalAmount;

    // Aplicar el pago según la distribucion calculada
    appliedDistribution.forEach(dist => {
        const paymentEntry = this.amortizationTable.find(p => p.number === dist.paymentNumber);

        if (paymentEntry) {
            // Actualizar montos
            paymentEntry.amountPaid += dist.appliedAmount;
            paymentEntry.amountRemaining -= dist.appliedAmount;

            // Actualizar estado
            if (paymentEntry.amountRemaining <= 0) {
                paymentEntry.status = 'paid';
                paymentEntry.amountRemaining = 0;
            } else if (paymentEntry.amountPaid > 0) {
                paymentEntry.status = 'partial';
            }

            // Agregar registro de pago
            paymentEntry.payments.push({
                paymentId: paymentId,
                appliedAmount: dist.appliedAmount,
                paidOn: new Date()
            });

            // LEGACY: Si se pago completo, guardar referencia
            if (paymentEntry.status === 'paid' && !paymentEntry.paymentReference) {
                paymentEntry.paymentReference = paymentId;
            }
        }
    });

    // Actualizar balance y total pagado
    this.totalPaid += totalAmount;
    this.balance -= totalAmount;

    // Si el balance es 0 o negativo, marcar como pagado
    if (this.balance <= 0) {
        this.status = 'paid';
        this.balance = 0;
    }

    return this;
};

// Metodo: Marcar pagos vencidos
SaleSchema.methods.updateOverduePayments = function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.amortizationTable.forEach(payment => {
        if (payment.status === 'pending' && payment.dueDate < today) {
            payment.status = 'overdue';
        }
    });

    // Si hay pagos vencidos, marcar la venta como overdue
    const hasOverdue = this.amortizationTable.some(p => p.status === 'overdue');
    if (hasOverdue && this.status === 'active') {
        this.status = 'overdue';
    }

    return this;
};

// Metodo: Cancelar venta
SaleSchema.methods.cancel = function (userId, reason, refundAmount, refundMethod, refundNotes) {
    this.status = 'cancelled';
    this.cancellationInfo = {
        cancelledBy: userId,
        cancelledAt: new Date(),
        reason: reason || 'Sin especificar',
        refundAmount: refundAmount || 0,
        refundMethod: refundMethod || 'cash',
        refundNotes: refundNotes || ''
    };

    return this;
};

// Asegurar que virtuals se incluyan en JSON
SaleSchema.set('toJSON', { virtuals: true });
SaleSchema.set('toObject', { virtuals: true });

// Middleware: Validar que balance = totalAmount - downPayment (solo en creación)
SaleSchema.pre('validate', function (next) {
    if (this.isNew && this.totalAmount && this.downPayment) {
        const calculatedBalance = this.totalAmount - this.downPayment;
        if (this.balance !== calculatedBalance) {
            this.balance = calculatedBalance;
        }

        // Inicializar totalPaid con el enganche
        if (!this.totalPaid || this.totalPaid === 0) {
            this.totalPaid = this.downPayment;
        }

        // Inicializar amountRemaining en cada pago
        this.amortizationTable.forEach(payment => {
            if (payment.amountRemaining === undefined || payment.amountRemaining === payment.amount) {
                payment.amountRemaining = payment.amount;
            }
        });
    }
});

module.exports = mongoose.model('Sale', SaleSchema);
