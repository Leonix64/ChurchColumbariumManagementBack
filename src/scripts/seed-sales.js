require('dotenv').config();
const mongoose = require('mongoose');

const Sale               = require('../modules/columbarium/models/sale.model');
const Payment            = require('../modules/columbarium/models/payment.model');
const AmortSchedule      = require('../modules/columbarium/models/amortSchedule.model');
const PaymentScheduleLink = require('../modules/columbarium/models/paymentScheduleLink.model');
const Niche              = require('../modules/columbarium/models/niche.model');
const Customer           = require('../modules/columbarium/models/customer.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Conectado para crear ventas de prueba...'))
    .catch(err => {
        console.error('[ERROR] Conexión fallida:', err.message);
        process.exit(1);
    });

/**
 * Genera documentos de cuotas para AmortSchedule.
 * Todos en estado 'pending' — ajustar después si es necesario.
 */
function generateAmortDocs(saleId, monthlyAmount, months) {
    const docs = [];
    const now = new Date();
    for (let i = 1; i <= months; i++) {
        const dueDate = new Date(now);
        dueDate.setMonth(dueDate.getMonth() + i);
        docs.push({
            sale:            saleId,
            number:          i,
            dueDate,
            amount:          String(monthlyAmount),
            amountPaid:      '0',
            amountRemaining: String(monthlyAmount),
            status:          'pending'
        });
    }
    return docs;
}

const seedSales = async () => {
    try {
        // ── 1. Limpiar datos previos (orden de dependencias) ─────────────────
        await PaymentScheduleLink.deleteMany({});
        await AmortSchedule.deleteMany({});
        await Payment.deleteMany({});
        await Sale.deleteMany({});
        await Niche.updateMany(
            { status: { $ne: 'disabled' } },
            { status: 'available', currentOwner: null }
        );
        console.log('[INFO] Datos previos eliminados\n');

        // ── 2. Cargar prerequisites ──────────────────────────────────────────
        const customers = await Customer.find({ active: true }).limit(4);
        const niches    = await Niche.find({ status: 'available' }).limit(4);

        if (customers.length < 4 || niches.length < 4) {
            console.error('[ERROR] Necesitas correr seed:customers y seed:niches primero');
            process.exit(1);
        }

        let totalAmortDocs = 0;
        let totalPayments  = 0;
        let totalLinks     = 0;

        // ════════════════════════════════════════════════════════════════════
        // VENTA 1 — Activa, sin pagos mensuales aplicados
        //   totalAmount: 30000 | downPayment: 5000
        //   balance: 25000 | totalPaid: 5000
        //   monthly: 1388.89 (25000 ÷ 18)
        // ════════════════════════════════════════════════════════════════════
        const sale1 = await Sale.create({
            niche:       niches[0]._id,
            customer:    customers[0]._id,
            folio:       'VTA-SEED-001',
            totalAmount: '30000',
            downPayment: '5000',
            // balance = 25000 y totalPaid = 5000 los calcula pre('validate')
            monthsToPay: 18,
            status:      'active'
        });

        const amort1Docs = generateAmortDocs(sale1._id, 1388.89, 18);
        await AmortSchedule.insertMany(amort1Docs);
        totalAmortDocs += amort1Docs.length;

        await Payment.create({
            sale:          sale1._id,
            customer:      customers[0]._id,
            niche:         niches[0]._id,
            receiptNumber: 'REC-SEED-001',
            amount:        '5000',
            concept:       'down_payment',
            method:        'cash',
            balanceBefore: '30000',
            balanceAfter:  '25000',
            paymentDate:   new Date(),
            status:        'completed'
        });
        totalPayments++;

        // ════════════════════════════════════════════════════════════════════
        // VENTA 2 — Activa, con 3 cuotas mensuales ya pagadas
        //   totalAmount: 30000 | downPayment: 5000
        //   balance: 20833.33 | totalPaid: 9166.67
        //   Cálculo: balance = 25000 − (3 × 1388.89) = 20833.33
        //            totalPaid = 5000 + (3 × 1388.89) = 9166.67
        //
        //   ⚠️ pre('validate') fuerza balance = 25000 en create;
        //      se corrige con findByIdAndUpdate después del save.
        //   ⚠️ totalPaid se pasa explícito (> 0) para que el hook
        //      no lo sobreescriba con el enganche.
        // ════════════════════════════════════════════════════════════════════
        const sale2 = await Sale.create({
            niche:       niches[1]._id,
            customer:    customers[1]._id,
            folio:       'VTA-SEED-002',
            totalAmount: '30000',
            downPayment: '5000',
            totalPaid:   '9166.67',   // hook no sobreescribe si > 0
            monthsToPay: 18,
            status:      'active'
        });
        // Corregir balance: pre('validate') lo dejó en 25000
        await Sale.findByIdAndUpdate(sale2._id, { balance: '20833.33' });

        const amort2Docs = generateAmortDocs(sale2._id, 1388.89, 18);
        // Cuotas 1–3: marcadas como pagadas
        for (let i = 0; i < 3; i++) {
            amort2Docs[i].amountPaid      = '1388.89';
            amort2Docs[i].amountRemaining = '0';
            amort2Docs[i].status          = 'paid';
        }
        const amort2 = await AmortSchedule.insertMany(amort2Docs);
        totalAmortDocs += amort2.length;

        // 3 pagos mensuales + PaymentScheduleLinks
        const monthlyReceipts = ['REC-SEED-002', 'REC-SEED-003', 'REC-SEED-004'];
        for (let i = 0; i < 3; i++) {
            const balBefore = String((25000 - i * 1388.89).toFixed(2));
            const balAfter  = String((25000 - (i + 1) * 1388.89).toFixed(2));

            const payment = await Payment.create({
                sale:          sale2._id,
                customer:      customers[1]._id,
                niche:         niches[1]._id,
                receiptNumber: monthlyReceipts[i],
                amount:        '1388.89',
                concept:       'monthly_payment',
                method:        'transfer',
                balanceBefore: balBefore,
                balanceAfter:  balAfter,
                paymentDate:   new Date(),
                status:        'completed'
            });
            totalPayments++;

            await PaymentScheduleLink.create({
                payment:       payment._id,
                amortEntry:    amort2[i]._id,
                appliedAmount: '1388.89',
                paidOn:        payment.paymentDate
            });
            totalLinks++;
        }

        // ════════════════════════════════════════════════════════════════════
        // VENTA 3 — Activa, con cuota 1 vencida
        //   totalAmount: 30000 | downPayment: 3000
        //   balance: 27000 | totalPaid: 3000
        //   monthly: 1500 (27000 ÷ 18)
        // ════════════════════════════════════════════════════════════════════
        const sale3 = await Sale.create({
            niche:       niches[2]._id,
            customer:    customers[2]._id,
            folio:       'VTA-SEED-003',
            totalAmount: '30000',
            downPayment: '3000',
            // balance = 27000 y totalPaid = 3000 los calcula pre('validate')
            monthsToPay: 18,
            status:      'active'
        });

        const amort3Docs = generateAmortDocs(sale3._id, 1500, 18);
        // Cuota 1: vencida (hace 2 meses)
        const overdueDate = new Date();
        overdueDate.setMonth(overdueDate.getMonth() - 2);
        amort3Docs[0].dueDate = overdueDate;
        amort3Docs[0].status  = 'overdue';

        await AmortSchedule.insertMany(amort3Docs);
        totalAmortDocs += amort3Docs.length;

        // ════════════════════════════════════════════════════════════════════
        // VENTA 4 — Pagada completamente (enganche = totalAmount)
        //   totalAmount: 30000 | downPayment: 30000
        //   balance: 0 | totalPaid: 30000
        //   1 cuota de $0 (nada que financiar)
        // ════════════════════════════════════════════════════════════════════
        const sale4 = await Sale.create({
            niche:       niches[3]._id,
            customer:    customers[3]._id,
            folio:       'VTA-SEED-004',
            totalAmount: '30000',
            downPayment: '30000',
            // balance = 0 y totalPaid = 30000 los calcula pre('validate')
            monthsToPay: 1,
            status:      'paid'
        });

        // 1 cuota con monto 0 (balance a financiar = 0), ya liquidada
        const amort4Docs = generateAmortDocs(sale4._id, 0, 1);
        amort4Docs[0].amountPaid      = '0';
        amort4Docs[0].amountRemaining = '0';
        amort4Docs[0].status          = 'paid';
        await AmortSchedule.insertMany(amort4Docs);
        totalAmortDocs += amort4Docs.length;

        await Payment.create({
            sale:          sale4._id,
            customer:      customers[3]._id,
            niche:         niches[3]._id,
            receiptNumber: 'REC-SEED-005',
            amount:        '30000',
            concept:       'down_payment',
            method:        'cash',
            balanceBefore: '30000',
            balanceAfter:  '0',
            paymentDate:   new Date(),
            status:        'completed'
        });
        totalPayments++;

        // ── 3. Marcar nichos como vendidos ───────────────────────────────────
        for (let i = 0; i < 4; i++) {
            await Niche.findByIdAndUpdate(niches[i]._id, {
                status:       'sold',
                currentOwner: customers[i]._id
            });
        }

        // ── 4. Resumen ───────────────────────────────────────────────────────
        console.log('='.repeat(60));
        console.log('VENTAS DE PRUEBA CREADAS EXITOSAMENTE');
        console.log('='.repeat(60));
        console.log('');
        console.log(`✅ 4 ventas creadas`);
        console.log(`✅ AmortSchedule: ${totalAmortDocs} cuotas creadas`);
        // V1:18  V2:18  V3:18  V4:1  = 55
        console.log(`✅ Payments: ${totalPayments} pagos creados`);
        // V1:1(eng)  V2:3(mensual)  V3:0  V4:1(eng)  = 5
        console.log(`✅ PaymentScheduleLinks: ${totalLinks} vínculos creados`);
        // V2:3  = 3
        console.log('');
        console.log('Detalle:');
        console.log(`  VTA-SEED-001 — ${customers[0].firstName} ${customers[0].lastName}`);
        console.log('               Activa | balance $25,000 | 18 cuotas pendientes');
        console.log(`  VTA-SEED-002 — ${customers[1].firstName} ${customers[1].lastName}`);
        console.log('               Activa | balance $20,833.33 | 3 cuotas pagadas, 15 pendientes');
        console.log(`  VTA-SEED-003 — ${customers[2].firstName} ${customers[2].lastName}`);
        console.log('               Activa | balance $27,000 | cuota 1 VENCIDA, 17 pendientes');
        console.log(`  VTA-SEED-004 — ${customers[3].firstName} ${customers[3].lastName}`);
        console.log('               PAGADA | balance $0');
        console.log('');

        await mongoose.disconnect();
        console.log('[INFO] Seed completado exitosamente\n');
        process.exit(0);

    } catch (error) {
        console.error('[ERROR]', error.message || error);
        if (error.errors) {
            Object.values(error.errors).forEach(e => {
                console.error(`  • ${e.path}: ${e.message}`);
            });
        }
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedSales();
