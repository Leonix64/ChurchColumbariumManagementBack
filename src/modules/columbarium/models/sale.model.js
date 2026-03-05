const mongoose = require('mongoose');
const { toNumber, toDecimal } = require('../../../utils/decimal');

/**
 * Modelo de VENTA
 * Registra la compra de un nicho con credito a 18 meses
 */

const SaleSchema = new mongoose.Schema({
    // Nicho vendido
    niche: { type: mongoose.Schema.Types.ObjectId, ref: 'Niche', required: true },

    // Cliente comprador
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

    // Usuario que registro la venta
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

    // Folio unico de la venta
    folio: { type: String, unique: true },

    // Montos financieros
    totalAmount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
    },
    downPayment: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        validate: {
            validator: function (v) {
                return toNumber(v) <= toNumber(this.totalAmount);
            },
            message: 'El enganche no puede exceder el total'
        }
    },

    // El enganche inicial dinamico
    balance: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
    },

    // Total pagado hasta el momento
    totalPaid: {
        type: mongoose.Schema.Types.Decimal128,
        default: mongoose.Types.Decimal128.fromString('0')
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
        refundAmount: { type: mongoose.Schema.Types.Decimal128 },
        refundMethod: { type: String, enum: ['cash', 'card', 'transfer'] },
        refundNotes: String
    },

    // Notas adicionales
    notes: String
}, { timestamps: true, versionKey: false });

// Indices
SaleSchema.index({ customer: 1, status: 1 });
SaleSchema.index({ status: 1, createdAt: -1 });

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

// Asegurar que virtuals se incluyan en JSON y convertir Decimal128 → Number
SaleSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        if (ret.totalAmount != null)  ret.totalAmount  = toNumber(ret.totalAmount);
        if (ret.downPayment != null)  ret.downPayment  = toNumber(ret.downPayment);
        if (ret.balance != null)      ret.balance      = toNumber(ret.balance);
        if (ret.totalPaid != null)    ret.totalPaid    = toNumber(ret.totalPaid);
        if (ret.cancellationInfo && ret.cancellationInfo.refundAmount != null) {
            ret.cancellationInfo.refundAmount = toNumber(ret.cancellationInfo.refundAmount);
        }
        return ret;
    }
});
SaleSchema.set('toObject', { virtuals: true });

// Middleware: Validar que balance = totalAmount - downPayment (solo en creación)
SaleSchema.pre('validate', function (next) {
    if (this.isNew && this.totalAmount && this.downPayment) {
        this.balance = toDecimal(
            toNumber(this.totalAmount) - toNumber(this.downPayment)
        );

        // Inicializar totalPaid con el enganche
        if (toNumber(this.totalPaid) === 0) {
            this.totalPaid = toDecimal(toNumber(this.downPayment));
        }
    }
});

module.exports = mongoose.model('Sale', SaleSchema);
