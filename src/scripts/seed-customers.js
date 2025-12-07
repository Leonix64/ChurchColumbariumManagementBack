require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/columbarium/models/customer.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('👥 Conectado para crear clientes...'))
    .catch(err => console.error(err));

const seedCustomers = async () => {
    try {
        console.log('📝 Creando clientes de prueba...\n');

        const customers = [
            {
                firstName: 'Juan',
                lastName: 'Pérez',
                phone: '5551234567',
                email: 'juan.perez@email.com',
                rfc: 'PERJ800101ABC',
                address: 'Av. Principal 123, CDMX',
                emergencyContact: {
                    name: 'María Pérez',
                    phone: '5559876543',
                    relationship: 'Esposa'
                },
                beneficiaries: ['María Pérez', 'Pedro Pérez']
            },
            {
                firstName: 'María',
                lastName: 'García',
                phone: '5557654321',
                email: 'maria.garcia@email.com',
                rfc: 'GACM750505DEF',
                address: 'Calle Secundaria 456, Edo. Méx.',
                emergencyContact: {
                    name: 'Carlos García',
                    phone: '5558765432',
                    relationship: 'Hermano'
                },
                beneficiaries: ['Carlos García']
            },
            {
                firstName: 'Carlos',
                lastName: 'Rodríguez',
                phone: '5558889999',
                email: 'carlos.rodriguez@email.com',
                rfc: 'RODC900202GHI',
                address: 'Privada Norte 789, Puebla',
                emergencyContact: {
                    name: 'Ana Rodríguez',
                    phone: '5557776666',
                    relationship: 'Hija'
                },
                beneficiaries: ['Ana Rodríguez', 'Luis Rodríguez']
            }
        ];

        await Customer.insertMany(customers);

        console.log(`✅ ${customers.length} clientes creados\n`);

        // Mostrar IDs para usar en pruebas
        const created = await Customer.find({});
        console.log('🆔 IDs generados (copia para pruebas):');
        created.forEach(c => {
            console.log(`   ${c.firstName} ${c.lastName}: ${c._id}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

seedCustomers();
