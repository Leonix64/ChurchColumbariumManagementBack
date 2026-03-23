require('dotenv').config();
const mongoose = require('mongoose');
require('./src/modules/columbarium/models/index.model');
const Niche = require('./src/modules/columbarium/models/niche.model');
const Sale  = require('./src/modules/columbarium/models/sale.model');

async function fixOwnershipHistory() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[INFO] Conectado a MongoDB\n');

    // Nichos vendidos sin ownershipHistory
    const niches = await Niche.find({
        status: 'sold',
        $or: [
            { ownershipHistory: { $exists: false } },
            { ownershipHistory: { $size: 0 } }
        ]
    });

    console.log(`[INFO] Nichos vendidos sin historial: ${niches.length}\n`);

    if (niches.length === 0) {
        console.log('[OK] No hay nichos a corregir.');
        await mongoose.disconnect();
        return;
    }

    let corregidos = 0;
    let sinVenta   = 0;

    for (const niche of niches) {
        // Buscar venta activa/pagada para este nicho
        const sale = await Sale.findOne({
            niche: niche._id,
            status: { $in: ['active', 'overdue', 'paid'] }
        }).lean();

        if (!sale) {
            console.log(`[SKIP] ${niche.code} — sin venta activa`);
            sinVenta++;
            continue;
        }

        // Agregar entry inicial al historial
        niche.ownershipHistory = [{
            owner:        sale.customer,
            startDate:    sale.createdAt || new Date(),
            reason:       'purchase',
            notes:        `Venta ${sale.folio}`,
            registeredBy: sale.user || undefined
        }];

        await niche.save();
        console.log(`[OK] ${niche.code} → folio ${sale.folio}`);
        corregidos++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`[SUCCESS] Corregidos: ${corregidos} | Saltados (sin venta): ${sinVenta}`);
    console.log('='.repeat(60));

    await mongoose.disconnect();
}

fixOwnershipHistory().catch(err => {
    console.error('[ERROR]', err);
    process.exit(1);
});
