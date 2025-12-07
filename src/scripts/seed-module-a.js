require('dotenv').config();
const mongoose = require('mongoose');
const Niche = require('../modules/columbarium/models/niche.model');

/**
 * CREA 357 NICHOS DEL MÓDULO A SECCIÓN A
 * 7 filas × 51 columnas = 357 nichos
 * Últimas 8 columnas de cada fila son de mármol
 */
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🌱 Conectado para crear nichos...'))
    .catch(err => console.error(err));

const seedModuleA = async () => {
    try {
        console.log('🏗️ Creando Módulo A, Sección A...\n');

        // Limpiar nichos existentes (opcional)
        await Niche.deleteMany({ module: 'A', section: 'A' });

        const niches = [];
        let displayNumber = 1;

        // 7 filas (1 = abajo, 7 = arriba)
        for (let row = 1; row <= 7; row++) {
            // 51 columnas por fila
            for (let col = 1; col <= 51; col++) {
                // Columnas 44-51 son mármol
                const isMarble = col >= 44;
                const type = isMarble ? 'marble' : 'wood';
                const price = isMarble ? 35000 : 30000;

                niches.push({
                    code: `A-A-${row}-${col}`,
                    displayNumber: displayNumber,
                    module: 'A',
                    section: 'A',
                    row: row,
                    number: col,
                    type: type,
                    price: price,
                    status: 'available'
                });

                displayNumber++;
            }
        }

        await Niche.insertMany(niches);

        console.log(`✅ ¡Éxito! ${niches.length} nichos creados`);
        console.log(`📊 Resumen:`);
        console.log(`   • Madera: ${niches.filter(n => n.type === 'wood').length} nichos`);
        console.log(`   • Mármol: ${niches.filter(n => n.type === 'marble').length} nichos`);
        console.log(`   • Precio madera: $30,000`);
        console.log(`   • Precio mármol: $35,000\n`);

        console.log('🔍 Ejemplos:');
        console.log(`   Nicho 1: ${niches[0].code} - $${niches[0].price}`);
        console.log(`   Nicho 44 (primero mármol): ${niches[43].code} - $${niches[43].price}`);
        console.log(`   Último nicho: ${niches[356].code} - $${niches[356].price}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

seedModuleA();
