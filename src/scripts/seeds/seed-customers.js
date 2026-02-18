require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../../modules/customer/models/customer.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Conectado para crear clientes con beneficiarios...'))
    .catch(err => console.error('[ERROR]', err));

const seedCustomers = async () => {
    try {
        console.log('[INFO] Creando clientes de prueba con beneficiarios completos...\n');

        // Limpiar clientes existentes (opcional)
        // await Customer.deleteMany({});

        const customers = [
            {
                firstName: 'Roberto',
                lastName: 'MartÃ­nez GarcÃ­a',
                phone: '4491234567',
                email: 'roberto.martinez@email.com',
                rfc: 'MAGR850315AB3',
                address: 'Av. Independencia 123, Col. Centro, Durango, DGO, CP 34000',
                emergencyContact: {
                    name: 'Ana MartÃ­nez RodrÃ­guez',
                    phone: '4499876543',
                    relationship: 'Esposa'
                },
                beneficiaries: [
                    {
                        name: 'Ana MartÃ­nez RodrÃ­guez',
                        relationship: 'esposa',
                        phone: '4499876543',
                        email: 'ana.martinez@email.com',
                        dateOfBirth: new Date('1987-08-20'),
                        isDeceased: false,
                        order: 1,
                        notes: 'Beneficiaria principal - Esposa'
                    },
                    {
                        name: 'Luis MartÃ­nez RodrÃ­guez',
                        relationship: 'hijo',
                        phone: '4497778888',
                        email: 'luis.martinez@email.com',
                        dateOfBirth: new Date('2010-05-15'),
                        isDeceased: false,
                        order: 2,
                        notes: 'Segundo beneficiario - Hijo mayor'
                    },
                    {
                        name: 'Carmen MartÃ­nez RodrÃ­guez',
                        relationship: 'hija',
                        phone: '4496665555',
                        email: 'carmen.martinez@email.com',
                        dateOfBirth: new Date('2015-11-30'),
                        isDeceased: false,
                        order: 3,
                        notes: 'Tercer beneficiario - Hija menor'
                    }
                ],
                active: true
            },
            {
                firstName: 'Patricia',
                lastName: 'GÃ³mez HernÃ¡ndez',
                phone: '4497654321',
                email: 'patricia.gomez@email.com',
                rfc: 'GOHP780820DE7',
                address: 'Calle ConstituciÃ³n 456, Col. JardÃ­n, Durango, DGO, CP 34050',
                emergencyContact: {
                    name: 'Carlos GÃ³mez PÃ©rez',
                    phone: '4498765432',
                    relationship: 'Hermano'
                },
                beneficiaries: [
                    {
                        name: 'Carlos GÃ³mez PÃ©rez',
                        relationship: 'hermano',
                        phone: '4498765432',
                        email: 'carlos.gomez@email.com',
                        dateOfBirth: new Date('1975-03-12'),
                        isDeceased: false,
                        order: 1,
                        notes: 'Beneficiario principal - Hermano mayor'
                    },
                    {
                        name: 'SofÃ­a GÃ³mez RamÃ­rez',
                        relationship: 'sobrina',
                        phone: '4495554444',
                        email: 'sofia.gomez@email.com',
                        dateOfBirth: new Date('1998-07-08'),
                        isDeceased: false,
                        order: 2,
                        notes: 'Segundo beneficiario - Sobrina'
                    },
                    {
                        name: 'MarÃ­a HernÃ¡ndez LÃ³pez',
                        relationship: 'madre',
                        phone: '4493332222',
                        email: 'maria.hernandez@email.com',
                        dateOfBirth: new Date('1950-12-25'),
                        isDeceased: false,
                        order: 3,
                        notes: 'Tercer beneficiario - Madre'
                    }
                ],
                active: true
            },
            {
                firstName: 'Fernando',
                lastName: 'LÃ³pez SÃ¡nchez',
                phone: '4498889999',
                email: 'fernando.lopez@email.com',
                rfc: 'LOSF920505GH1',
                address: 'Priv. Hidalgo 789, Col. Guadalupe, Durango, DGO, CP 34100',
                emergencyContact: {
                    name: 'MarÃ­a LÃ³pez Torres',
                    phone: '4497776666',
                    relationship: 'Madre'
                },
                beneficiaries: [
                    {
                        name: 'Gabriela Torres DÃ­az',
                        relationship: 'esposa',
                        phone: '4491112233',
                        email: 'gabriela.torres@email.com',
                        dateOfBirth: new Date('1994-02-14'),
                        isDeceased: false,
                        order: 1,
                        notes: 'Beneficiaria principal - Esposa'
                    },
                    {
                        name: 'MarÃ­a LÃ³pez Torres',
                        relationship: 'madre',
                        phone: '4497776666',
                        email: 'maria.lopez@email.com',
                        dateOfBirth: new Date('1965-09-10'),
                        isDeceased: false,
                        order: 2,
                        notes: 'Segundo beneficiario - Madre'
                    },
                    {
                        name: 'Jorge LÃ³pez Torres',
                        relationship: 'hermano',
                        phone: '4494445566',
                        email: 'jorge.lopez@email.com',
                        dateOfBirth: new Date('1988-06-22'),
                        isDeceased: false,
                        order: 3,
                        notes: 'Tercer beneficiario - Hermano'
                    }
                ],
                active: true
            },
            {
                firstName: 'Carmen',
                lastName: 'HernÃ¡ndez Ruiz',
                phone: '4495556666',
                email: 'carmen.hernandez@email.com',
                rfc: 'HERC880210JK4',
                address: 'Blvd. Durango 321, Col. Las Rosas, Durango, DGO, CP 34200',
                emergencyContact: {
                    name: 'Pedro HernÃ¡ndez Castro',
                    phone: '4496667777',
                    relationship: 'Esposo'
                },
                beneficiaries: [
                    {
                        name: 'Pedro HernÃ¡ndez Castro',
                        relationship: 'esposo',
                        phone: '4496667777',
                        email: 'pedro.hernandez@email.com',
                        dateOfBirth: new Date('1985-04-18'),
                        isDeceased: false,
                        order: 1,
                        notes: 'Beneficiario principal - Esposo'
                    },
                    {
                        name: 'Daniela HernÃ¡ndez Ruiz',
                        relationship: 'hija',
                        phone: '4492223344',
                        email: 'daniela.hernandez@email.com',
                        dateOfBirth: new Date('2012-11-05'),
                        isDeceased: false,
                        order: 2,
                        notes: 'Segundo beneficiario - Hija'
                    },
                    {
                        name: 'Rosa Ruiz Mendoza',
                        relationship: 'madre',
                        phone: '4498889000',
                        email: 'rosa.ruiz@email.com',
                        dateOfBirth: new Date('1960-01-30'),
                        isDeceased: false,
                        order: 3,
                        notes: 'Tercer beneficiario - Madre'
                    }
                ],
                active: true
            },
            {
                firstName: 'Miguel',
                lastName: 'RamÃ­rez Flores',
                phone: '4493334444',
                email: 'miguel.ramirez@email.com',
                rfc: 'RAFM750615MN2',
                address: 'Calle JuÃ¡rez 654, Col. Centro, Durango, DGO, CP 34000',
                emergencyContact: {
                    name: 'Laura RamÃ­rez GarcÃ­a',
                    phone: '4492223333',
                    relationship: 'Hija'
                },
                beneficiaries: [
                    {
                        name: 'Laura RamÃ­rez GarcÃ­a',
                        relationship: 'hija',
                        phone: '4492223333',
                        email: 'laura.ramirez@email.com',
                        dateOfBirth: new Date('1995-08-28'),
                        isDeceased: false,
                        order: 1,
                        notes: 'Beneficiaria principal - Hija mayor'
                    },
                    {
                        name: 'Daniel RamÃ­rez GarcÃ­a',
                        relationship: 'hijo',
                        phone: '4497778899',
                        email: 'daniel.ramirez@email.com',
                        dateOfBirth: new Date('1998-03-17'),
                        isDeceased: false,
                        order: 2,
                        notes: 'Segundo beneficiario - Hijo menor'
                    },
                    {
                        name: 'Elena Flores Morales',
                        relationship: 'esposa',
                        phone: '4495556677',
                        email: 'elena.flores@email.com',
                        dateOfBirth: new Date('1977-12-05'),
                        isDeceased: true,
                        deceasedDate: new Date('2022-06-15'),
                        order: 3,
                        notes: 'Tercer beneficiario - Esposa (fallecida)'
                    }
                ],
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
                    name: 'Ricardo Torres LÃ³pez',
                    phone: '4493334455',
                    relationship: 'Padre'
                },
                beneficiaries: [
                    {
                        name: 'Ricardo Torres LÃ³pez',
                        relationship: 'padre',
                        phone: '4493334455',
                        email: 'ricardo.torres@email.com',
                        dateOfBirth: new Date('1962-07-20'),
                        isDeceased: false,
                        order: 1,
                        notes: 'Beneficiario principal - Padre'
                    },
                    {
                        name: 'MÃ³nica Medina GarcÃ­a',
                        relationship: 'madre',
                        phone: '4491112244',
                        email: 'monica.medina@email.com',
                        dateOfBirth: new Date('1965-10-15'),
                        isDeceased: false,
                        order: 2,
                        notes: 'Segundo beneficiario - Madre'
                    },
                    {
                        name: 'AndrÃ©s Torres Medina',
                        relationship: 'hermano',
                        phone: '4497779988',
                        email: 'andres.torres@email.com',
                        dateOfBirth: new Date('1988-04-08'),
                        isDeceased: false,
                        order: 3,
                        notes: 'Tercer beneficiario - Hermano'
                    }
                ],
                active: true
            }
        ];

        const created = await Customer.insertMany(customers);

        console.log(`[SUCCESS] ${created.length} clientes creados con beneficiarios completos\n`);

        console.log('IDs GENERADOS (copiar para testing):');
        console.log('='.repeat(70));
        created.forEach(c => {
            console.log(`\n${c.firstName} ${c.lastName}:`);
            console.log(`  ID: ${c._id}`);
            console.log(`  RFC: ${c.rfc || 'N/A'}`);
            console.log(`  TelÃ©fono: ${c.phone}`);
            console.log(`  Email: ${c.email || 'N/A'}`);
            console.log(`  Beneficiarios: ${c.beneficiaries.length}`);
            c.beneficiaries.forEach((b, idx) => {
                console.log(`    ${idx + 1}. ${b.name} (${b.relationship})${b.isDeceased ? ' âœŸ' : ''}`);
            });
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
