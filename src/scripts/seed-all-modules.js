require('dotenv').config();
const mongoose = require('mongoose');
const Niche = require('../modules/columbarium/models/niche.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Conectado para poblar TODOS los módulos del columbario...'))
    .catch(err => {
        console.error('[ERROR]', err);
        process.exit(1);
    });

/**
 * CONFIGURACIÓN DE TODOS LOS MÓDULOS
 * Aquí defines la estructura completa del columbario
 */
const MODULES_CONFIG = {
    // MÓDULO A - Resurrección (YA EXISTE, pero lo incluyo por si quieres recrear)
    A: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 51,
                marbleFrom: 44, // Columnas 44-51 son mármol
                prices: { wood: '30000', marble: '35000' }
            }
        }
    },

    // MÓDULO B - TODO MÁRMOL
    B: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 9,
                marbleFrom: 1, // TODO ES MÁRMOL
                prices: { marble: '35000' }
            }
        }
    },

    // MÓDULO C - Virgen del Perpetuo Socorro (TODO MADERA)
    C: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 9,
                startNumber: 1,
                marbleFrom: 999, // Ninguno es mármol
                prices: { wood: '30000' }
            },
            B: {
                rows: 7,
                nichesPerRow: 9,
                startNumber: 10,
                marbleFrom: 999,
                prices: { wood: '30000' }
            }
        }
    },

    // MÓDULO D - Virgen del Rosario (TODO MADERA)
    D: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 14,
                startNumber: 1,
                marbleFrom: 999,
                prices: { wood: '30000' }
            },
            B: {
                rows: 7,
                nichesPerRow: 14,
                startNumber: 15,
                marbleFrom: 999,
                prices: { wood: '30000' }
            }
        }
    },

    // MÓDULO E - Nuestra Señora del Refugio (TODO MADERA)
    E: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 20,
                startNumber: 1,
                marbleFrom: 999,
                prices: { wood: '30000' }
            },
            B: {
                rows: 7,
                nichesPerRow: 20,
                startNumber: 21,
                marbleFrom: 999,
                prices: { wood: '30000' }
            }
        }
    },

    // MÓDULO F - Virgen de Guadalupe (TODO MADERA)
    F: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 26,
                startNumber: 1,
                marbleFrom: 999,
                prices: { wood: '30000' }
            },
            B: {
                rows: 7,
                nichesPerRow: 26,
                startNumber: 27,
                marbleFrom: 999,
                prices: { wood: '30000' }
            }
        }
    },

    // MÓDULO G - Virgen de Fátima (TODO MADERA)
    G: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 9,
                marbleFrom: 999,
                prices: { wood: '30000' }
            }
        }
    },

    // MÓDULO H - San Juan de los Lagos (TODO MADERA)
    H: {
        sections: {
            A: {
                rows: 7,
                nichesPerRow: 7,
                marbleFrom: 999,
                prices: { wood: '30000' }
            }
        }
    }
};

/**
 * GENERA TODOS LOS NICHOS DE UN MÓDULO
 */
const generateModuleNiches = (moduleName, moduleConfig) => {
    const niches = [];
    let displayNumber = 1; // 🔑 ÚNICO POR MÓDULO

    for (let row = 1; row <= 7; row++) {
        for (const [sectionName, sectionConfig] of Object.entries(moduleConfig.sections)) {
            const {
                nichesPerRow,
                marbleFrom,
                prices
            } = sectionConfig;

            for (let col = 1; col <= nichesPerRow; col++) {
                const isMarble = col >= marbleFrom;
                const type = isMarble ? 'marble' : 'wood';
                const price = isMarble
                    ? prices.marble
                    : (prices.wood || prices.marble);

                niches.push({
                    code: `${moduleName}-${sectionName}-${row}-${displayNumber}`,
                    displayNumber,
                    module: moduleName,
                    section: sectionName,
                    row,
                    number: col,
                    type,
                    price,
                    status: 'available',
                    notes: ''
                });

                displayNumber++;
            }
        }
    }

    return niches;
};

/**
 * SEED PRINCIPAL
 */
const seedAllModules = async () => {
    try {
        console.log('');
        console.log('='.repeat(70));
        console.log('GENERANDO ESTRUCTURA COMPLETA DEL COLUMBARIO');
        console.log('='.repeat(70));
        console.log('');

        // OPCIÓN: ¿Limpiar TODO o solo agregar nuevos?
        const clearExisting = process.argv.includes('--clear');

        if (clearExisting) {
            console.log('LIMPIANDO TODOS LOS NICHOS EXISTENTES...');
            await Niche.deleteMany({});
            console.log('Base de datos limpia\n');
        } else {
            console.log('ℹAgregando solo módulos nuevos (usa --clear para limpiar todo)\n');
        }

        let totalNiches = 0;
        let totalWood = 0;
        let totalMarble = 0;

        // Generar nichos por módulo
        for (const [moduleName, moduleConfig] of Object.entries(MODULES_CONFIG)) {
            console.log(`Generando Módulo ${moduleName}...`);

            const niches = generateModuleNiches(moduleName, moduleConfig);

            // Insertar en la base de datos
            await Niche.insertMany(niches);

            const woodCount = niches.filter(n => n.type === 'wood').length;
            const marbleCount = niches.filter(n => n.type === 'marble').length;

            console.log(`   ✅ ${niches.length} nichos creados`);
            console.log(`      🪵 Madera: ${woodCount}`);
            console.log(`      💎 Mármol: ${marbleCount}`);
            console.log('');

            totalNiches += niches.length;
            totalWood += woodCount;
            totalMarble += marbleCount;
        }

        // RESUMEN FINAL
        console.log('='.repeat(70));
        console.log('COLUMBARIO COMPLETADO');
        console.log('='.repeat(70));
        console.log('');
        console.log(`TOTAL DE NICHOS: ${totalNiches}`);
        console.log(`   🪵 Madera:  ${totalWood} (${((totalWood / totalNiches) * 100).toFixed(1)}%)`);
        console.log(`   💎 Mármol:  ${totalMarble} (${((totalMarble / totalNiches) * 100).toFixed(1)}%)`);
        console.log('');

        // Estadísticas por módulo
        console.log('📈 DISTRIBUCIÓN POR MÓDULO:');
        for (const moduleName of Object.keys(MODULES_CONFIG)) {
            const count = await Niche.countDocuments({ module: moduleName });
            console.log(`   ${moduleName}: ${count} nichos`);
        }
        console.log('');

        // Ejemplos de códigos generados
        console.log('EJEMPLOS DE CÓDIGOS GENERADOS:');
        const samples = [
            await Niche.findOne({ module: 'B', section: 'A' }),
            await Niche.findOne({ module: 'C', section: 'B' }),
            await Niche.findOne({ module: 'F', section: 'A' }),
            await Niche.findOne({ module: 'H', section: 'A' })
        ];

        samples.filter(Boolean).forEach(n => {
            console.log(`   ${n.code.padEnd(15)} → #${String(n.displayNumber).padEnd(4)} (${n.type})`);
        });

        console.log('');
        console.log('='.repeat(70));
        console.log('');

        await mongoose.disconnect();
        console.log('[INFO] Seed completado exitosamente 🎉\n');
        process.exit(0);

    } catch (error) {
        console.error('\n[ERROR]', error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

// EJECUTAR
seedAllModules();
