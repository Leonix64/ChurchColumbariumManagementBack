/**
 * Servicio de Amortización
 * Genera tablas de amortización y calcula distribución de pagos
 */

const amortizationService = {
    /**
     * Generar tabla de amortización a 18 meses
     * @param {number} balance - Saldo a financiar (totalAmount - downPayment)
     * @param {number} months - Número de meses (default 18)
     * @param {Date} startDate - Fecha inicio (default hoy)
     * @returns {Array} Tabla de amortización
     */
    generateTable(balance, months = 18, startDate = new Date()) {
        const monthlyAmount = Number((balance / months).toFixed(2));
        const table = [];

        for (let i = 1; i <= months; i++) {
            let paymentDate = new Date(startDate);
            paymentDate.setMonth(paymentDate.getMonth() + i);

            // Ajustar si el día retrocedió (ej: 31 ene + 1 mes = 28 feb)
            const targetMonth = (startDate.getMonth() + i) % 12;
            if (paymentDate.getMonth() !== targetMonth && paymentDate.getMonth() !== (targetMonth + 1) % 12) {
                paymentDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 0);
            }

            table.push({
                number: i,
                dueDate: paymentDate,
                amount: monthlyAmount,
                amountPaid: 0,
                amountRemaining: monthlyAmount,
                status: 'pending',
                payments: []
            });
        }

        return table;
    },

    /**
     * Calcular distribución de pago en la tabla de amortización
     * @param {Array} amortizationTable - Tabla de amortización actual
     * @param {number} totalAmount - Monto total a distribuir
     * @param {string} mode - 'specific' para pago específico, otro para libre
     * @param {number} specificNumber - Número de pago específico (si mode === 'specific')
     * @returns {Array} Distribución del pago
     */
    calculatePaymentDistribution(amortizationTable, totalAmount, mode, specificNumber) {
        const distribution = [];
        let remainingAmount = totalAmount;

        const sortedPayments = amortizationTable
            .slice()
            .sort((a, b) => a.number - b.number);

        if (mode === 'specific' && specificNumber) {
            const targetPayment = sortedPayments.find(p => p.number === specificNumber);

            if (!targetPayment || targetPayment.status === 'paid') {
                return distribution;
            }

            const toApply = Math.min(remainingAmount, targetPayment.amountRemaining);

            distribution.push({
                paymentNumber: targetPayment.number,
                appliedAmount: toApply,
                remainingBefore: targetPayment.amountRemaining,
                remainingAfter: targetPayment.amountRemaining - toApply
            });

            return distribution;
        }

        // Modo libre: distribuir automáticamente
        for (const payment of sortedPayments) {
            if (remainingAmount <= 0) break;
            if (payment.status === 'paid') continue;

            const toApply = Math.min(remainingAmount, payment.amountRemaining);

            distribution.push({
                paymentNumber: payment.number,
                appliedAmount: toApply,
                remainingBefore: payment.amountRemaining,
                remainingAfter: payment.amountRemaining - toApply
            });

            remainingAmount -= toApply;
        }

        return distribution;
    }
};

module.exports = amortizationService;
