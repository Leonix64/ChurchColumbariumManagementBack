require('dotenv').config();
const mongoose = require('mongoose');
require('../modules/columbarium/models/index.model');
const Beneficiary = require('../modules/columbarium/models/beneficiary.model');
const Niche = require('../modules/columbarium/models/niche.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Conectado para crear beneficiarios...'))
    .catch(err => console.error('[ERROR]', err));

const seedBeneficiaries = async () => {
    try {
        console.log('[INFO] Creando beneficiarios de prueba...\n');

        // Limpiar beneficiarios existentes
        await Beneficiary.deleteMany({});
        console.log('[INFO] Beneficiarios eliminados\n');

        // Cargar los 4 nichos vendidos (los que creó seed-sales.js)
        const niches = await Niche.find({ status: 'sold' }).sort({ code: 1 }).limit(4);

        if (niches.length < 4) {
            console.error(`[ERROR] Se esperaban 4 nichos vendidos, se encontraron ${niches.length}.`);
            console.error('[ERROR] Ejecuta seed:sales primero: npm run seed:sales');
            process.exit(1);
        }

        console.log(`[INFO] ${niches.length} nichos vendidos encontrados:`);
        niches.forEach(n => console.log(`  - ${n.code} (${n._id})`));
        console.log('');

        // Beneficiarios por nicho — mismos datos que el seed anterior, ahora ligados al nicho
        const beneficiariosPorNicho = [
            // Nicho 0 — Roberto Martínez García
            [
                {
                    niche: niches[0]._id,
                    name: 'Ana Martínez Rodríguez',
                    relationship: 'esposa',
                    phone: '4499876543',
                    email: 'ana.martinez@email.com',
                    dateOfBirth: new Date('1987-08-20'),
                    isDeceased: false,
                    order: 1,
                    notes: 'Beneficiaria principal - Esposa'
                },
                {
                    niche: niches[0]._id,
                    name: 'Luis Martínez Rodríguez',
                    relationship: 'hijo',
                    phone: '4497778888',
                    email: 'luis.martinez@email.com',
                    dateOfBirth: new Date('2010-05-15'),
                    isDeceased: false,
                    order: 2,
                    notes: 'Segundo beneficiario - Hijo mayor'
                },
                {
                    niche: niches[0]._id,
                    name: 'Carmen Martínez Rodríguez',
                    relationship: 'hija',
                    phone: '4496665555',
                    email: 'carmen.martinez@email.com',
                    dateOfBirth: new Date('2015-11-30'),
                    isDeceased: false,
                    order: 3,
                    notes: 'Tercer beneficiario - Hija menor'
                }
            ],
            // Nicho 1 — Patricia Gómez Hernández
            [
                {
                    niche: niches[1]._id,
                    name: 'Carlos Gómez Pérez',
                    relationship: 'hermano',
                    phone: '4498765432',
                    email: 'carlos.gomez@email.com',
                    dateOfBirth: new Date('1975-03-12'),
                    isDeceased: false,
                    order: 1,
                    notes: 'Beneficiario principal - Hermano mayor'
                },
                {
                    niche: niches[1]._id,
                    name: 'Sofía Gómez Ramírez',
                    relationship: 'sobrina',
                    phone: '4495554444',
                    email: 'sofia.gomez@email.com',
                    dateOfBirth: new Date('1998-07-08'),
                    isDeceased: false,
                    order: 2,
                    notes: 'Segundo beneficiario - Sobrina'
                },
                {
                    niche: niches[1]._id,
                    name: 'María Hernández López',
                    relationship: 'madre',
                    phone: '4493332222',
                    email: 'maria.hernandez@email.com',
                    dateOfBirth: new Date('1950-12-25'),
                    isDeceased: false,
                    order: 3,
                    notes: 'Tercer beneficiario - Madre'
                }
            ],
            // Nicho 2 — Fernando López Sánchez
            [
                {
                    niche: niches[2]._id,
                    name: 'Gabriela Torres Díaz',
                    relationship: 'esposa',
                    phone: '4491112233',
                    email: 'gabriela.torres@email.com',
                    dateOfBirth: new Date('1994-02-14'),
                    isDeceased: false,
                    order: 1,
                    notes: 'Beneficiaria principal - Esposa'
                },
                {
                    niche: niches[2]._id,
                    name: 'María López Torres',
                    relationship: 'madre',
                    phone: '4497776666',
                    email: 'maria.lopez@email.com',
                    dateOfBirth: new Date('1965-09-10'),
                    isDeceased: false,
                    order: 2,
                    notes: 'Segundo beneficiario - Madre'
                },
                {
                    niche: niches[2]._id,
                    name: 'Jorge López Torres',
                    relationship: 'hermano',
                    phone: '4494445566',
                    email: 'jorge.lopez@email.com',
                    dateOfBirth: new Date('1988-06-22'),
                    isDeceased: false,
                    order: 3,
                    notes: 'Tercer beneficiario - Hermano'
                }
            ],
            // Nicho 3 — Carmen Hernández Ruiz
            [
                {
                    niche: niches[3]._id,
                    name: 'Pedro Hernández Castro',
                    relationship: 'esposo',
                    phone: '4496667777',
                    email: 'pedro.hernandez@email.com',
                    dateOfBirth: new Date('1985-04-18'),
                    isDeceased: false,
                    order: 1,
                    notes: 'Beneficiario principal - Esposo'
                },
                {
                    niche: niches[3]._id,
                    name: 'Daniela Hernández Ruiz',
                    relationship: 'hija',
                    phone: '4492223344',
                    email: 'daniela.hernandez@email.com',
                    dateOfBirth: new Date('2012-11-05'),
                    isDeceased: false,
                    order: 2,
                    notes: 'Segundo beneficiario - Hija'
                },
                {
                    niche: niches[3]._id,
                    name: 'Rosa Ruiz Mendoza',
                    relationship: 'madre',
                    phone: '4498889000',
                    email: 'rosa.ruiz@email.com',
                    dateOfBirth: new Date('1960-01-30'),
                    isDeceased: false,
                    order: 3,
                    notes: 'Tercer beneficiario - Madre'
                }
            ]
        ];

        let totalCreados = 0;

        for (let i = 0; i < beneficiariosPorNicho.length; i++) {
            const docs = beneficiariosPorNicho[i];
            const creados = await Beneficiary.insertMany(docs);
            totalCreados += creados.length;

            console.log(`[INFO] Nicho ${niches[i].code} — ${creados.length} beneficiarios creados:`);
            creados.forEach(b => {
                console.log(`  ${b.order}. ${b.name} (${b.relationship})`);
            });
            console.log('');
        }

        console.log('='.repeat(70));
        console.log(`[SUCCESS] ${totalCreados} beneficiarios creados en total`);
        console.log('='.repeat(70));
        console.log('\n[INFO] Seed completado exitosamente\n');

        process.exit(0);
    } catch (error) {
        console.error('[ERROR]', error);
        process.exit(1);
    }
};

seedBeneficiaries();
