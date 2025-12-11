require('dotenv').config();
const mongoose = require('mongoose');

// IMPORTANTE: Importar Customer primero para evitar error
const Customer = require('../modules/columbarium/models/customer.model');
const Niche = require('../modules/columbarium/models/niche.model');
const Sale = require('../modules/columbarium/models/sale.model');
const Payment = require('../modules/columbarium/models/payment.model');

/**
 * PRUEBA COMPLETA DE VENTA - VERSIÓN CORREGIDA
 * Soluciona el error "next is not a function"
 */
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('💰 Conectado para prueba de venta...');
        testSaleFlow().catch(console.error);
    })
    .catch(err => console.error(err));

const testSaleFlow = async () => {
    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        console.log('🚀 INICIANDO PRUEBA DE VENTA COMPLETA\n');
        console.log('='.repeat(50));

        // 1. BUSCAR CLIENTE (con sesión)
        const customer = await Customer.findOne({}).session(session);
        if (!customer) {
            throw new Error('❌ No hay clientes. Ejecuta: npm run seed:customers');
        }
        console.log(`👤 CLIENTE: ${customer.firstName} ${customer.lastName}`);
        console.log(`   📞 ${customer.phone}`);
        console.log(`   📧 ${customer.email}`);

        // 2. BUSCAR NICHOS DISPONIBLE (con sesión)
        const niche = await Niche.findOne({
            status: 'available',
            type: 'wood'
        }).session(session);

        if (!niche) {
            throw new Error('❌ No hay nichos disponibles');
        }
        console.log(`\n🏛️ NICHOS: ${niche.code}`);
        console.log(`   📍 Módulo ${niche.module}, Sección ${niche.section}`);
        console.log(`   🏷️ Tipo: ${niche.type}`);
        console.log(`   💰 Precio: $${niche.price.toLocaleString()}`);

        // 3. DATOS DE VENTA
        const totalAmount = niche.price;
        const downPayment = 5000;
        const balance = totalAmount - downPayment;
        const months = 18;
        const monthlyPayment = Number((balance / months).toFixed(2));

        console.log(`\n💰 DATOS FINANCIEROS:`);
        console.log(`   Total: $${totalAmount.toLocaleString()}`);
        console.log(`   Enganche: $${downPayment.toLocaleString()}`);
        console.log(`   Saldo: $${balance.toLocaleString()}`);
        console.log(`   Plazo: ${months} meses`);
        console.log(`   Mensualidad: $${monthlyPayment.toLocaleString()}`);

        // 4. TABLA DE AMORTIZACIÓN
        let amortizationTable = [];
        let currentDate = new Date();

        for (let i = 1; i <= months; i++) {
            let dueDate = new Date(currentDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            amortizationTable.push({
                number: i,
                dueDate,
                amount: monthlyPayment,
                status: 'pending'
            });
        }

        // 5. CREAR VENTA - FORMA CORREGIDA
        const saleData = {
            niche: niche._id,
            customer: customer._id,
            folio: `TEST-${Date.now()}`,
            totalAmount,
            downPayment,
            balance,
            monthsToPay: months,
            amortizationTable,
            status: 'active'
        };

        console.log('\n📄 CREANDO VENTA...');
        
        // Usar create en lugar de save+new para evitar problemas con middleware
        const sale = await Sale.create([saleData], { session });
        const createdSale = sale[0]; // create devuelve array
        
        console.log(`✅ VENTA CREADA: Folio ${createdSale.folio}`);

        // 6. REGISTRAR PAGO - FORMA CORREGIDA
        const paymentData = {
            sale: createdSale._id,
            customer: customer._id,
            receiptNumber: `REC-TEST-${Date.now()}`,
            amount: downPayment,
            concept: 'down_payment',
            method: 'cash',
            paymentDate: new Date()
        };

        console.log('💳 REGISTRANDO PAGO...');
        const payment = await Payment.create([paymentData], { session });
        console.log(`✅ PAGO REGISTRADO: ${payment[0].receiptNumber}`);

        // 7. ACTUALIZAR NICHOS
        console.log('🔄 ACTUALIZANDO NICHOS...');
        await Niche.updateOne(
            { _id: niche._id },
            { 
                status: 'sold',
                currentOwner: customer._id,
                $set: { updatedAt: new Date() }
            },
            { session }
        );
        console.log(`✅ NICHOS ACTUALIZADO: ${niche.code} → VENDIDO`);

        // 8. CONFIRMAR TRANSACCIÓN
        await session.commitTransaction();
        console.log('✅ TRANSACCIÓN CONFIRMADA');

        console.log('\n' + '='.repeat(50));
        console.log('🎉 ¡PRUEBA EXITOSA!');
        console.log('='.repeat(50));

        console.log('\n📋 RESUMEN FINAL:');
        console.log(`   • Cliente: ${customer.firstName} ${customer.lastName}`);
        console.log(`   • Nicho: ${niche.code} (${niche.type})`);
        console.log(`   • Contrato: ${createdSale.folio}`);
        console.log(`   • Enganche: $${downPayment.toLocaleString()}`);
        console.log(`   • 18 mensualidades de: $${monthlyPayment.toLocaleString()}`);
        console.log(`   • Primer pago: ${amortizationTable[0].dueDate.toLocaleDateString()}`);

    } catch (error) {
        console.error('\n❌ ERROR EN LA PRUEBA:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Intentar hacer rollback
        try {
            await session.abortTransaction();
            console.log('🔄 Transacción revertida');
        } catch (abortError) {
            console.error('Error al revertir transacción:', abortError.message);
        }
        
        throw error; // Re-lanzar el error
    } finally {
        // Siempre cerrar la sesión
        try {
            session.endSession();
            console.log('🔚 Sesión de MongoDB cerrada');
        } catch (endError) {
            console.error('Error al cerrar sesión:', endError.message);
        }
        
        // Cerrar conexión
        await mongoose.connection.close();
        console.log('🔌 Conexión a MongoDB cerrada');
    }
};