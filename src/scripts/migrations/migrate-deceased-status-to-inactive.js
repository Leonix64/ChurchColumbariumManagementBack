/**
 * Migración: Customer.status 'deceased' → 'inactive'
 *
 * Contexto: En el refactor de Feb 2026, Customer.status 'deceased' fue eliminado.
 * Después de sucesión, el propietario anterior ahora queda como 'inactive'.
 * Los registros legacy con status 'deceased' deben normalizarse a 'inactive'.
 *
 * Uso:
 *   node src/scripts/migrations/migrate-deceased-status-to-inactive.js
 *
 * Seguro de re-ejecutar: usa updateMany que solo afecta documents con { status: 'deceased' }.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('❌  MONGODB_URI o MONGO_URI no definida en .env');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('✅  Conectado a MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('customers');

    // Contar registros afectados antes
    const count = await collection.countDocuments({ status: 'deceased' });
    console.log(`📋  Clientes con status 'deceased': ${count}`);

    if (count === 0) {
        console.log('✅  Nada que migrar. La base de datos ya está actualizada.');
        await mongoose.disconnect();
        return;
    }

    // Migrar: 'deceased' → 'inactive'
    const result = await collection.updateMany(
        { status: 'deceased' },
        { $set: { status: 'inactive' } }
    );

    console.log(`✅  Actualizados: ${result.modifiedCount} clientes ('deceased' → 'inactive')`);

    // Verificación
    const remaining = await collection.countDocuments({ status: 'deceased' });
    if (remaining === 0) {
        console.log('✅  Verificación OK: no quedan registros con status deceased.');
    } else {
        console.warn(`⚠️  Quedan ${remaining} registros con status deceased. Revisar manualmente.`);
    }

    await mongoose.disconnect();
    console.log('🔌  Desconectado de MongoDB');
}

run().catch(err => {
    console.error('❌  Error en migración:', err);
    process.exit(1);
});
