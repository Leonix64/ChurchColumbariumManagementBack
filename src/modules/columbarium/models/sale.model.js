const mongoose = require('mongoose');

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
    //user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

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
    }, // El enganche inicial
    balance: {
        type: Number,
        required: true,
        min: [0, 'El saldo no puede ser negativo']
    }, // Saldo pendiente

    // Terminos del credito
    monthsToPay: { type: Number, default: 18 },
    interestRate: { type: Number, default: 0 }, // Tasa de interes anual

    // Estado del contrato
    status: { type: String, enum: ['active', 'paid', 'cancelled'], default: 'active' },

    /** Tabla de AMORTIZACION 
     * Generada automaticamente al crear la venta
     * Ejemplo:
     * [
     *   { number: 1, dueDate: '2024-07-15', amount: 1000, status: 'pending' },
     *   { number: 2, dueDate: '2024-08-15', amount: 1000, status: 'pending' },
     * ]
    */
    amortizationTable: [{
        number: Number,
        dueDate: Date,
        amount: {
            type: Number,
            required: true,
            min: [1, 'El monto de la cuota debe ser mayor a 0']
        },
        status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
        paymentReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' } // Se llena al pagar
    }]
}, { timestamps: true });

// Middleware para validar que balance = totalAmount - downPayment
SaleSchema.pre('validate', function (next) {
    if (this.totalAmount && this.downPayment) {
        const calculatedBalance = this.totalAmount - this.downPayment;
        if (this.balance !== calculatedBalance) {
            this.invalidate('balance', `El saldo debe ser ${calculatedBalance} (total - enganche)`);
        }
    }
    next();
});

module.exports = mongoose.model('Sale', SaleSchema);
