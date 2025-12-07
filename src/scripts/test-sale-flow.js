require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/columbarium/models/customer.model');
const Niche = require('../modules/columbarium/models/niche.model');
const Sale = require('../modules/columbarium/models/sale.model');
const Payment = require('../modules/columbarium/models/payment.model');

/**
 * PRUEBA COMPLETA DE VENTA
 * Simula una venta real con transacción
 */
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('💰 Conectado para prueba de venta...'))
    .catch(err => console.error(err));

const testSaleFlow = async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log('🚀 INICIANDO PRUEBA DE VENTA COMPLETA\n');
        console.log('='.repeat(50));

        // 1. BUSCAR CLIENTE
        const customer = await Customer.findOne({}).session(session);
        if (!customer) {
            throw new Error('❌ No hay clientes. Ejecuta: npm run seed:customers');
        }
        console.log(`👤 CLIENTE: ${customer.firstName} ${customer.lastName}`);
        console.log(`   📞 ${customer.phone}`);
        console.log(`   📧 ${customer.email}`);

        // 2. BUSCAR NICHOS DISPONIBLE
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

        // 5. CREAR VENTA
        const sale = new Sale({
            niche: niche._id,
            customer: customer._id,
            folio: `TEST-${Date.now()}`,
            totalAmount,
            downPayment,
            balance,
            monthsToPay: months,
            amortizationTable
        });

        await sale.save({ session });
        console.log(`\n📄 VENTA CREADA: Folio ${sale.folio}`);

        // 6. REGISTRAR PAGO
        const payment = new Payment({
            sale: sale._id,
            customer: customer._id,
            receiptNumber: `REC-TEST-${Date.now()}`,
            amount: downPayment,
            concept: 'down_payment',
            method: 'cash'
        });

        await payment.save({ session });
        console.log(`💳 PAGO REGISTRADO: ${payment.receiptNumber}`);

        // 7. ACTUALIZAR NICHOS
        niche.status = 'sold';
        niche.currentOwner = customer._id;
        await niche.save({ session });
        console.log(`✅ NICHOS ACTUALIZADO: ${niche.code} → VENDIDO`);

        // 8. CONFIRMAR TRANSACCIÓN
        await session.commitTransaction();

        console.log('\n' + '='.repeat(50));
        console.log('🎉 ¡PRUEBA EXITOSA!');
        console.log('='.repeat(50));

        console.log('\n📋 RESUMEN FINAL:');
        console.log(`   • Cliente: ${customer.firstName} ${customer.lastName}`);
        console.log(`   • Nicho: ${niche.code} (${niche.type})`);
        console.log(`   • Contrato: ${sale.folio}`);
        console.log(`   • Enganche: $${downPayment.toLocaleString()}`);
        console.log(`   • 18 mensualidades de: $${monthlyPayment.toLocaleString()}`);
        console.log(`   • Primer pago: ${amortizationTable[0].dueDate.toLocaleDateString()}`);

    } catch (error) {
        await session.abortTransaction();
        console.error('\n❌ ERROR EN LA PRUEBA:', error.message);
    } finally {
        session.endSession();
        mongoose.connection.close();
    }
};

testSaleFlow();
