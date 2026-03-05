require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/columbarium/models/customer.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Conectado para crear clientes...'))
    .catch(err => console.error('[ERROR]', err));

const seedCustomers = async () => {
    try {
        console.log('[INFO] Creando clientes de prueba...\n');

        // Limpiar clientes existentes
        await Customer.deleteMany({});
        console.log('[INFO] Clientes eliminados\n');

        const customers = [
            {
                firstName: 'Roberto',
                lastName: 'Martínez García',
                phone: '4491234567',
                email: 'roberto.martinez@email.com',
                rfc: 'MAGR850315AB3',
                address: 'Av. Independencia 123, Col. Centro, Durango, DGO, CP 34000',
                emergencyContact: {
                    name: 'Ana Martínez Rodríguez',
                    phone: '4499876543',
                    relationship: 'Esposa'
                },
                active: true
            },
            {
                firstName: 'Patricia',
                lastName: 'Gómez Hernández',
                phone: '4497654321',
                email: 'patricia.gomez@email.com',
                rfc: 'GOHP780820DE7',
                address: 'Calle Constitución 456, Col. Jardín, Durango, DGO, CP 34050',
                emergencyContact: {
                    name: 'Carlos Gómez Pérez',
                    phone: '4498765432',
                    relationship: 'Hermano'
                },
                active: true
            },
            {
                firstName: 'Fernando',
                lastName: 'López Sánchez',
                phone: '4498889999',
                email: 'fernando.lopez@email.com',
                rfc: 'LOSF920505GH1',
                address: 'Priv. Hidalgo 789, Col. Guadalupe, Durango, DGO, CP 34100',
                emergencyContact: {
                    name: 'María López Torres',
                    phone: '4497776666',
                    relationship: 'Madre'
                },
                active: true
            },
            {
                firstName: 'Carmen',
                lastName: 'Hernández Ruiz',
                phone: '4495556666',
                email: 'carmen.hernandez@email.com',
                rfc: 'HERC880210JK4',
                address: 'Blvd. Durango 321, Col. Las Rosas, Durango, DGO, CP 34200',
                emergencyContact: {
                    name: 'Pedro Hernández Castro',
                    phone: '4496667777',
                    relationship: 'Esposo'
                },
                active: true
            },
            {
                firstName: 'Miguel',
                lastName: 'Ramírez Flores',
                phone: '4493334444',
                email: 'miguel.ramirez@email.com',
                rfc: 'RAFM750615MN2',
                address: 'Calle Juárez 654, Col. Centro, Durango, DGO, CP 34000',
                emergencyContact: {
                    name: 'Laura Ramírez García',
                    phone: '4492223333',
                    relationship: 'Hija'
                },
                active: true
            },
            {
                firstName: 'Alejandra',
                lastName: 'Torres Medina',
                phone: '4496667788',
                email: 'alejandra.torres@email.com',
                rfc: 'TOMA901125PQ5',
                address: 'Av. Universidad 890, Col. Universitaria, Durango, DGO, CP 34300',
                emergencyContact: {
                    name: 'Ricardo Torres López',
                    phone: '4493334455',
                    relationship: 'Padre'
                },
                active: true
            }
        ];

        const created = await Customer.insertMany(customers);

        console.log(`[SUCCESS] ${created.length} clientes creados\n`);

        console.log('IDs GENERADOS (copiar para testing):');
        console.log('='.repeat(70));
        created.forEach(c => {
            console.log(`\n${c.firstName} ${c.lastName}:`);
            console.log(`  ID: ${c._id}`);
            console.log(`  RFC: ${c.rfc || 'N/A'}`);
            console.log(`  Teléfono: ${c.phone}`);
            console.log(`  Email: ${c.email || 'N/A'}`);
        });

        console.log('\n' + '='.repeat(70));
        console.log('\n[INFO] Seed completado exitosamente\n');

        process.exit(0);
    } catch (error) {
        console.error('[ERROR]', error);
        process.exit(1);
    }
};

seedCustomers();
