require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/columbarium/models/customer.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Connected to create customers...'))
    .catch(err => console.error('[ERROR]', err));

const seedCustomers = async () => {
    try {
        console.log('[INFO] Creating test customers...\n');

        const customers = [
            {
                firstName: 'Roberto',
                lastName: 'Martinez',
                phone: '4491234567',
                email: 'roberto.martinez@email.com',
                rfc: 'MARR850315ABC',
                address: 'Av. Independencia 123, Col. Centro, Durango, DGO',
                emergencyContact: {
                    name: 'Ana Martinez',
                    phone: '4499876543',
                    relationship: 'Esposa'
                },
                beneficiaries: ['Ana Martinez', 'Luis Martinez']
            },
            {
                firstName: 'Patricia',
                lastName: 'Gomez',
                phone: '4497654321',
                email: 'patricia.gomez@email.com',
                rfc: 'GOMP780820DEF',
                address: 'Calle Constitucion 456, Col. Jardin, Durango, DGO',
                emergencyContact: {
                    name: 'Carlos Gomez',
                    phone: '4498765432',
                    relationship: 'Hermano'
                },
                beneficiaries: ['Carlos Gomez', 'Sofia Gomez']
            },
            {
                firstName: 'Fernando',
                lastName: 'Lopez',
                phone: '4498889999',
                email: 'fernando.lopez@email.com',
                rfc: 'LOPF920505GHI',
                address: 'Priv. Hidalgo 789, Col. Guadalupe, Durango, DGO',
                emergencyContact: {
                    name: 'Maria Lopez',
                    phone: '4497776666',
                    relationship: 'Madre'
                },
                beneficiaries: ['Maria Lopez', 'Jorge Lopez']
            },
            {
                firstName: 'Carmen',
                lastName: 'Hernandez',
                phone: '4495556666',
                email: 'carmen.hernandez@email.com',
                rfc: 'HERC880210JKL',
                address: 'Blvd. Durango 321, Col. Las Rosas, Durango, DGO',
                emergencyContact: {
                    name: 'Pedro Hernandez',
                    phone: '4496667777',
                    relationship: 'Esposo'
                },
                beneficiaries: ['Pedro Hernandez']
            },
            {
                firstName: 'Miguel',
                lastName: 'Ramirez',
                phone: '4493334444',
                email: 'miguel.ramirez@email.com',
                rfc: 'RAMM750615MNO',
                address: 'Calle Juarez 654, Col. Centro, Durango, DGO',
                emergencyContact: {
                    name: 'Laura Ramirez',
                    phone: '4492223333',
                    relationship: 'Hija'
                },
                beneficiaries: ['Laura Ramirez', 'Daniel Ramirez']
            }
        ];

        await Customer.insertMany(customers);

        console.log(`[SUCCESS] ${customers.length} customers created\n`);

        const created = await Customer.find({});
        console.log('Generated IDs (copy for testing):');
        created.forEach(c => {
            console.log(`  ${c.firstName} ${c.lastName}: ${c._id}`);
        });

        console.log('\n[INFO] Seed completed successfully\n');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR]', error);
        process.exit(1);
    }
};

seedCustomers();
