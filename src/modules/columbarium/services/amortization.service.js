const AmortSchedule = require('../models/amortSchedule.model');
const { toNumber } = require('../../../utils/decimal');
const { nowUTC, lastDayOfMonthUTC } = require('../../../utils/dateHelpers');

/**
 * Marca como 'overdue' las cuotas pendientes/parciales cuya fecha ya venció.
 * @param {string} saleId
 */
async function updateOverdueEntries(saleId) {
    const now = nowUTC();
    await AmortSchedule.updateMany(
        {
            sale: saleId,
            status: { $in: ['pending', 'partial'] },
            dueDate: { $lt: now }
        },
        { $set: { status: 'overdue' } }
    );
}

/**
 * Genera entradas de amortización con distribución justa de redondeo.
 * Las primeras cuotas absorben el residuo (pesos extra), las últimas quedan
 * con el monto base. La suma de todos los amounts == balance exactamente.
 * @param {number} balance   - Monto total a financiar (totalAmount - downPayment)
 * @param {number} months    - Número de cuotas
 * @param {Date}   startDate - Fecha base desde la cual calcular vencimientos
 * @returns {Array} Entradas de amortización (amount como número, sin Decimal128)
 */
function buildSchedule(balance, months, startDate) {
    const base = Math.floor(balance / months);
    const remainder = Math.round((balance - base * months) * 100) / 100;
    const extraCount = Math.round(remainder);

    const entries = [];
    let accumulated = 0;

    for (let i = 0; i < months; i++) {
        const amount = i < extraCount ? base + 1 : base;
        accumulated += amount;

        const dueDate = lastDayOfMonthUTC(startDate, i + 1);

        entries.push({
            number: i + 1,
            dueDate,
            amount,
            amountPaid: 0,
            amountRemaining: amount,
            status: 'pending'
        });
    }

    // Ajuste de seguridad: corrige desviaciones por floating-point en última cuota
    const diff = balance - accumulated;
    if (diff !== 0) {
        entries[months - 1].amount += diff;
        entries[months - 1].amountRemaining += diff;
    }

    return entries;
}

/**
 * Calcula cómo distribuir un monto de pago entre las cuotas pendientes.
 * @param {Array}  pendingEntries    - Documentos AmortSchedule con Decimal128
 * @param {number} totalAmount       - Monto total a aplicar
 * @param {string} mode              - 'specific' o libre (cualquier otro valor)
 * @param {number} specificNumber    - Número de cuota (solo en modo 'specific')
 * @returns {Array} Distribución: [{ amortEntryId, number, appliedAmount, remainingBefore, remainingAfter }]
 */
function calculatePaymentDistribution(pendingEntries, totalAmount, mode, specificNumber) {
    const distribution = [];
    let remainingAmount = totalAmount;

    const sortedEntries = pendingEntries
        .slice()
        .sort((a, b) => a.number - b.number);

    if (mode === 'specific' && specificNumber) {
        const targetEntry = sortedEntries.find(e => e.number === specificNumber);
        if (!targetEntry || targetEntry.status === 'paid') return distribution;

        const remaining = toNumber(targetEntry.amountRemaining);
        const toApply = Math.min(remainingAmount, remaining);

        distribution.push({
            amortEntryId: targetEntry._id,
            number: targetEntry.number,
            appliedAmount: toApply,
            remainingBefore: remaining,
            remainingAfter: remaining - toApply
        });

        return distribution;
    }

    // Modo libre: distribuir automáticamente de la cuota más antigua a la más nueva
    for (const entry of sortedEntries) {
        if (remainingAmount <= 0) break;
        if (entry.status === 'paid') continue;

        const remaining = toNumber(entry.amountRemaining);
        const toApply = Math.min(remainingAmount, remaining);

        distribution.push({
            amortEntryId: entry._id,
            number: entry.number,
            appliedAmount: toApply,
            remainingBefore: remaining,
            remainingAfter: remaining - toApply
        });

        remainingAmount -= toApply;
    }

    return distribution;
}

module.exports = { buildSchedule, calculatePaymentDistribution, updateOverdueEntries };
