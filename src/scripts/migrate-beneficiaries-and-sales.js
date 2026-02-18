/**
 * SCRIPT DE MIGRACIÓN
 *
 * Ejecuta las siguientes operaciones:
 * 1. Backfill originalCustomer y currentCustomer en Sales existentes
 * 2. Copiar beneficiarios embebidos de Customer → colección Beneficiary (por nicho)
 *
 * IMPORTANTE:
 * - Hacer backup de la base de datos antes de ejecutar
 * - Ejecutar una sola vez
 * - Es idempotente (no duplica si se ejecuta de nuevo)
 *
 * Uso: node src/scripts/migrate-beneficiaries-and-sales.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/customer/models/customer.model');
const Sale = require('../modules/sale/models/sale.model');
const Beneficiary = require('../modules/beneficiary/models/beneficiary.model');
const Niche = require('../modules/niche/models/niche.model');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[INFO] Conectado a MongoDB');
        console.log('='.repeat(70));

        // ─────────────────────────────────────────────────────────
        // PASO 1: Backfill originalCustomer y currentCustomer en Sales
        // ─────────────────────────────────────────────────────────
        console.log('\n[PASO 1] Backfill originalCustomer/currentCustomer en Sales...');

        const salesWithoutOriginal = await Sale.find({
            originalCustomer: { $exists: false }
        });

        const salesWithNullOriginal = await Sale.find({
            originalCustomer: null
        });

        const salesToFix = [...salesWithoutOriginal, ...salesWithNullOriginal];
        // Deduplicar por _id
        const uniqueSales = [...new Map(salesToFix.map(s => [s._id.toString(), s])).values()];

        console.log(`  Ventas sin originalCustomer: ${uniqueSales.length}`);

        let salesFixed = 0;
        for (const sale of uniqueSales) {
            sale.originalCustomer = sale.customer;
            sale.currentCustomer = sale.customer;
            if (!sale.successionHistory) {
                sale.successionHistory = [];
            }
            await sale.save();
            salesFixed++;
        }

        console.log(`  ✓ ${salesFixed} ventas actualizadas`);

        // ─────────────────────────────────────────────────────────
        // PASO 2: Copiar beneficiarios embebidos → colección Beneficiary
        // ─────────────────────────────────────────────────────────
        console.log('\n[PASO 2] Migrar beneficiarios embebidos a colección independiente...');

        // Obtener todas las ventas activas con su nicho y cliente
        const activeSales = await Sale.find({
            status: { $in: ['active', 'overdue', 'paid'] }
        }).populate('customer');

        console.log(`  Ventas activas encontradas: ${activeSales.length}`);

        let beneficiariesCreated = 0;
        let salesSkipped = 0;

        for (const sale of activeSales) {
            const customer = sale.customer;
            if (!customer || !customer.beneficiaries || customer.beneficiaries.length === 0) {
                salesSkipped++;
                continue;
            }

            const nicheId = sale.niche;

            // Verificar si ya existen beneficiarios para este nicho
            const existingCount = await Beneficiary.countDocuments({ niche: nicheId });
            if (existingCount > 0) {
                console.log(`  ⊘ Nicho ${nicheId}: ya tiene ${existingCount} beneficiarios (saltando)`);
                salesSkipped++;
                continue;
            }

            // Crear beneficiarios en la colección independiente
            const beneficiaryDocs = customer.beneficiaries.map(b => ({
                name: b.name,
                relationship: b.relationship,
                phone: b.phone,
                email: b.email,
                dateOfBirth: b.dateOfBirth,
                niche: nicheId,
                designatedBy: customer._id,
                order: b.order,
                isActive: !b.isDeceased,
                isDeceased: b.isDeceased || false,
                deceasedDate: b.deceasedDate,
                notes: b.notes
            }));

            await Beneficiary.insertMany(beneficiaryDocs);
            beneficiariesCreated += beneficiaryDocs.length;
            console.log(`  ✓ Nicho ${nicheId}: ${beneficiaryDocs.length} beneficiarios migrados desde ${customer.firstName} ${customer.lastName}`);
        }

        console.log(`\n  Total beneficiarios creados: ${beneficiariesCreated}`);
        console.log(`  Ventas saltadas (sin beneficiarios o ya migrados): ${salesSkipped}`);

        // ─────────────────────────────────────────────────────────
        // RESUMEN
        // ─────────────────────────────────────────────────────────
        console.log('\n' + '='.repeat(70));
        console.log('[RESUMEN]');
        console.log(`  Sales con originalCustomer corregido: ${salesFixed}`);
        console.log(`  Beneficiarios migrados a colección: ${beneficiariesCreated}`);
        console.log(`  Total documentos Beneficiary: ${await Beneficiary.countDocuments()}`);
        console.log('='.repeat(70));
        console.log('\n[SUCCESS] Migración completada exitosamente\n');

        process.exit(0);
    } catch (error) {
        console.error('\n[ERROR] Migración fallida:', error);
        process.exit(1);
    }
}

migrate();
