require('dotenv').config();
const mongoose = require('mongoose');
const Niche = require('../modules/columbarium/models/niche.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🌱 Conectado para crear nichos CORREGIDOS...'))
    .catch(err => console.error(err));

const seedModuleAFixed = async () => {
    try {
        console.log('🏗️ Creando Módulo A, Sección A (CORREGIDO)...\n');

        // Limpiar nichos existentes del módulo A
        await Niche.deleteMany({ module: 'A', section: 'A' });

        const niches = [];
        
        // 7 filas (1 = abajo, 7 = arriba)
        // 51 columnas por fila
        let globalCounter = 1;
        
        for (let row = 1; row <= 7; row++) {
            for (let col = 1; col <= 51; col++) {
                // Columnas 44-51 son mármol (últimas 8 de cada fila)
                const isMarble = col >= 44;
                const type = isMarble ? 'marble' : 'wood';
                const price = isMarble ? 35000 : 30000;
                
                // Código CORRECTO: A-A-fila-numeroSecuencial
                const code = `A-A-${row}-${globalCounter}`;
                
                niches.push({
                    code: code,
                    displayNumber: globalCounter,
                    module: 'A',
                    section: 'A',
                    row: row,
                    number: col,  // Columna física dentro de la fila
                    type: type,
                    price: price,
                    status: 'available'
                });
                
                globalCounter++;
            }
        }

        await Niche.insertMany(niches);

        console.log(`✅ ¡Éxito! ${niches.length} nichos creados CORRECTAMENTE`);
        console.log(`📊 Resumen:`);
        console.log(`   • Madera: ${niches.filter(n => n.type === 'wood').length} nichos`);
        console.log(`   • Mármol: ${niches.filter(n => n.type === 'marble').length} nichos`);
        console.log(`   • Rango de códigos: ${niches[0].code} a ${niches[niches.length-1].code}`);
        console.log(`   • Rango display: ${niches[0].displayNumber} a ${niches[niches.length-1].displayNumber}\n`);

        console.log('🔍 Ejemplos verificados:');
        console.log(`   Nicho 1: ${niches[0].code} (fila 1, col 1)`);
        console.log(`   Nicho 51: ${niches[50].code} (fila 1, col 51)`);
        console.log(`   Nicho 52: ${niches[51].code} (fila 2, col 1) ← ¡CORRECTO!`);
        console.log(`   Último nicho (357): ${niches[356].code} (fila 7, col 51)`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

seedModuleAFixed();