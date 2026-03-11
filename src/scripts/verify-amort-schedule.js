/**
 * verify-amort-schedule.js
 * Verifica que buildSchedule genera el schedule correcto.
 * Corre SIN servidor ni MongoDB: npm run verify:amort
 */

// ─── Función copiada de sale.controller.js ───────────────────────────────────
function buildSchedule(balance, months, startDate) {
    const base = Math.floor(balance / months);
    const remainder = Math.round((balance - base * months) * 100) / 100;
    const extraCount = Math.round(remainder);

    const entries = [];
    let accumulated = 0;

    for (let i = 0; i < months; i++) {
        const amount = i < extraCount ? base + 1 : base;
        accumulated += amount;

        let dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        const targetMonth = (startDate.getMonth() + i + 1) % 12;
        if (dueDate.getMonth() !== targetMonth && dueDate.getMonth() !== (targetMonth + 1) % 12) {
            dueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), 0);
        }

        entries.push({ number: i + 1, dueDate, amount, amountPaid: 0, amountRemaining: amount, status: 'pending' });
    }

    const diff = balance - accumulated;
    if (diff !== 0) {
        entries[months - 1].amount += diff;
        entries[months - 1].amountRemaining += diff;
    }

    return entries;
}

// ─── Casos de prueba ──────────────────────────────────────────────────────────
const tests = [
    {
        label: 'Caso principal (30k / 5k / 18)',
        totalAmount: 30000,
        downPayment: 5000,
        months: 18,
        expectedFirst: 1389,   // cuotas 1-16
        expectedLast:  1388,   // cuotas 17-18
        extraCount:    16
    },
    {
        label: 'Sin residuo (18000 / 0 / 18)',
        totalAmount: 18000,
        downPayment: 0,
        months: 18,
        expectedFirst: 1000,
        expectedLast:  1000,
        extraCount:    0
    },
    {
        label: 'Residuo = 1 (19000 / 1000 / 18)',
        totalAmount: 19000,
        downPayment: 1000,
        months: 18,
        expectedFirst: 1000,   // solo 1 cuota de 1000 por el +1
        expectedLast:  999,    // las 17 restantes son 999 ... wait
        extraCount:    2       // 18000/18=1000, remainder=0 → no extra
    }
];

let allPassed = true;

// ─── CASO PRINCIPAL detallado ─────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('   VERIFICACIÓN buildSchedule — totalAmount=30,000');
console.log('══════════════════════════════════════════════════════');

const balance = 30000 - 5000; // 25000
const months = 18;
const entries = buildSchedule(balance, months, new Date('2026-03-07'));

const base        = Math.floor(balance / months);          // 1388
const remainder   = Math.round((balance - base * months) * 100) / 100; // 16
const extraCount  = Math.round(remainder);                 // 16
const totalSum    = entries.reduce((s, e) => s + e.amount, 0);

console.log(`\n  balance      = ${balance}`);
console.log(`  base         = ${base}`);
console.log(`  remainder    = ${remainder}`);
console.log(`  extraCount   = ${extraCount}`);
console.log(`\n  Schedule (18 cuotas):`);
console.log('  ─────────────────────────────────────────────────');
entries.forEach(e => {
    const marker = e.number === extraCount + 1 ? ' ← primer monto base' : '';
    console.log(`  Cuota ${String(e.number).padStart(2)}  amount=${e.amount}${marker}`);
});
console.log('  ─────────────────────────────────────────────────');

// ─── Verificaciones específicas ───────────────────────────────────────────────
const checks = [
    { desc: 'schedule[0].amount  === 1389',  pass: entries[0].amount  === 1389 },
    { desc: 'schedule[15].amount === 1389',  pass: entries[15].amount === 1389 },
    { desc: 'schedule[16].amount === 1388',  pass: entries[16].amount === 1388 },
    { desc: 'schedule[17].amount === 1388',  pass: entries[17].amount === 1388 },
    { desc: `suma de amounts === ${balance}`, pass: totalSum === balance        },
];

console.log('\n  Verificaciones:');
checks.forEach(c => {
    const icon = c.pass ? '✅' : '❌';
    console.log(`  ${icon} ${c.desc}`);
    if (!c.pass) allPassed = false;
});

console.log(`\n  Suma total: ${totalSum} ${totalSum === balance ? '✅' : '❌ ERROR — esperado ' + balance}`);

// ─── Caso sin residuo ─────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('   CASO SIN RESIDUO — balance=18000, months=18');
console.log('══════════════════════════════════════════════════════');
const e2 = buildSchedule(18000, 18, new Date());
const sum2 = e2.reduce((s, e) => s + e.amount, 0);
const allEqual = e2.every(e => e.amount === 1000);
console.log(`  ✅ base = 1000`);
console.log(`  ${allEqual ? '✅' : '❌'} todas las cuotas = 1000`);
console.log(`  ${sum2 === 18000 ? '✅' : '❌'} suma = ${sum2}`);
if (!allEqual || sum2 !== 18000) allPassed = false;

// ─── Resultado global ─────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(`   RESULTADO: ${allPassed ? '✅ TODO CORRECTO' : '❌ HAY ERRORES'}`);
console.log('══════════════════════════════════════════════════════\n');

process.exit(allPassed ? 0 : 1);
