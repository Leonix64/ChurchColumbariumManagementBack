require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/columbarium/models/customer.model');
const Niche = require('../modules/columbarium/models/niche.model');
const Sale = require('../modules/columbarium/models/sale.model');
const Payment = require('../modules/columbarium/models/payment.model');

/**
 * SEED MEJORADO PARA PRUEBAS DE VENTA
 * Versión interactiva con opciones personalizables
 */

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Conectado a MongoDB Atlas\n');
        testSaleFlow();
    })
    .catch(err => {
        console.error('❌ Error de conexión:', err.message);
        process.exit(1);
    });

// ============================================================================
// CONFIGURACIÓN DE LA PRUEBA
// ============================================================================
const SALE_CONFIG = {
    // Puedes cambiar estos valores para probar diferentes escenarios
    downPaymentPercentage: 20,  // 20% de enganche
    monthsToPay: 18,

    // Filtros para seleccionar nicho
    nichePreferences: {
        type: 'wood',           // 'wood', 'marble', o null para cualquiera
        module: null,           // 'A', 'B', etc., o null para cualquiera
        status: 'available'
    },

    // ¿Crear nuevo cliente o usar uno existente?
    createNewCustomer: false,

    // Datos del nuevo cliente (si createNewCustomer = true)
    newCustomerData: {
        firstName: 'Laura',
        lastName: 'Sánchez',
        phone: '6181112222',
        email: 'laura.sanchez@email.com',
        rfc: 'SALL900815XYZ',
        address: 'Calle Morelos 789, Col. Centro, Durango, DGO',
        emergencyContact: {
            name: 'Roberto Sánchez',
            phone: '6189998888',
            relationship: 'Padre'
        },
        beneficiaries: ['Roberto Sánchez', 'María Sánchez']
    }
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Formatea números a moneda mexicana
 */
const formatMoney = (amount) => {
    return `$${amount.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

/**
 * Calcula la tabla de amortización
 */
const generateAmortizationTable = (balance, months) => {
    const monthlyPayment = Number((balance / months).toFixed(2));
    const table = [];
    let currentDate = new Date();

    for (let i = 1; i <= months; i++) {
        let dueDate = new Date(currentDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        table.push({
            number: i,
            dueDate,
            amount: monthlyPayment,
            status: 'pending'
        });
    }

    return { table, monthlyPayment };
};

/**
 * Imprime una tabla de amortización bonita
 */
const printAmortizationTable = (table) => {
    console.log('\n📅 TABLA DE AMORTIZACIÓN:');
    console.log('─'.repeat(60));
    console.log('  # │ Fecha Vencimiento │ Monto a Pagar │ Estado');
    console.log('─'.repeat(60));

    table.slice(0, 5).forEach(payment => {
        const dateStr = payment.dueDate.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        console.log(
            `  ${String(payment.number).padStart(2)} │ ${dateStr.padEnd(17)} │ ${formatMoney(payment.amount).padEnd(13)} │ ${payment.status}`
        );
    });

    if (table.length > 5) {
        console.log('  ... (mostrando solo primeros 5 de ' + table.length + ' pagos)');
    }
    console.log('─'.repeat(60));
};

// ============================================================================
// FLUJO PRINCIPAL
// ============================================================================

const testSaleFlow = async () => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        console.log('═'.repeat(70));
        console.log('🏛️  SISTEMA DE VENTA DE NICHOS - PRUEBA COMPLETA'.padStart(50));
        console.log('═'.repeat(70));
        console.log('');

        // ========================================
        // PASO 1: OBTENER O CREAR CLIENTE
        // ========================================
        console.log('👤 PASO 1: CLIENTE');
        console.log('─'.repeat(70));

        let customer;

        if (SALE_CONFIG.createNewCustomer) {
            console.log('   Creando nuevo cliente...');
            const newCustomer = await Customer.create([SALE_CONFIG.newCustomerData], { session });
            customer = newCustomer[0];
            console.log('   ✅ Cliente creado exitosamente');
        } else {
            customer = await Customer.findOne({ active: true }).session(session);

            if (!customer) {
                throw new Error('❌ No hay clientes disponibles. Ejecuta: npm run seed:customers');
            }
            console.log('   ✅ Cliente seleccionado de la base de datos');
        }

        console.log('');
        console.log('   Nombre:    ' + customer.firstName + ' ' + customer.lastName);
        console.log('   Teléfono:  ' + customer.phone);
        console.log('   Email:     ' + (customer.email || 'No proporcionado'));
        console.log('   RFC:       ' + (customer.rfc || 'No proporcionado'));
        console.log('   ID:        ' + customer._id);

        // ========================================
        // PASO 2: SELECCIONAR NICHO
        // ========================================
        console.log('\n🏛️  PASO 2: SELECCIÓN DE NICHO');
        console.log('─'.repeat(70));

        const nicheFilter = {};
        if (SALE_CONFIG.nichePreferences.status) {
            nicheFilter.status = SALE_CONFIG.nichePreferences.status;
        }
        if (SALE_CONFIG.nichePreferences.type) {
            nicheFilter.type = SALE_CONFIG.nichePreferences.type;
        }
        if (SALE_CONFIG.nichePreferences.module) {
            nicheFilter.module = SALE_CONFIG.nichePreferences.module;
        }

        console.log('   Buscando nicho con criterios:');
        Object.entries(nicheFilter).forEach(([key, value]) => {
            console.log(`     • ${key}: ${value}`);
        });

        const niche = await Niche.findOne(nicheFilter).session(session);

        if (!niche) {
            throw new Error('❌ No hay nichos disponibles con esos criterios');
        }

        console.log('');
        console.log('   ✅ Nicho encontrado:');
        console.log('   Código:       ' + niche.code);
        console.log('   Número:       #' + niche.displayNumber);
        console.log('   Ubicación:    Módulo ' + niche.module + ', Sección ' + niche.section + ', Fila ' + niche.row);
        console.log('   Tipo:         ' + (niche.type === 'wood' ? '🪵 Madera' : '💎 Mármol'));
        console.log('   Precio:       ' + formatMoney(niche.price));
        console.log('   ID:           ' + niche._id);

        // ========================================
        // PASO 3: CÁLCULOS FINANCIEROS
        // ========================================
        console.log('\n💰 PASO 3: CÁLCULOS FINANCIEROS');
        console.log('─'.repeat(70));

        const totalAmount = niche.price;
        const downPayment = Math.round(totalAmount * (SALE_CONFIG.downPaymentPercentage / 100));
        const balance = totalAmount - downPayment;
        const months = SALE_CONFIG.monthsToPay;

        const { table: amortizationTable, monthlyPayment } = generateAmortizationTable(balance, months);

        console.log('');
        console.log('   Precio Total:           ' + formatMoney(totalAmount));
        console.log('   Enganche (' + SALE_CONFIG.downPaymentPercentage + '%):          ' + formatMoney(downPayment));
        console.log('   ─'.repeat(35));
        console.log('   Saldo a Financiar:      ' + formatMoney(balance));
        console.log('   Plazo:                  ' + months + ' meses');
        console.log('   Pago Mensual:           ' + formatMoney(monthlyPayment));
        console.log('   Tasa de Interés:        0% (sin intereses)');

        printAmortizationTable(amortizationTable);

        // ========================================
        // PASO 4: CREAR VENTA
        // ========================================
        console.log('\n📋 PASO 4: REGISTRO DE VENTA');
        console.log('─'.repeat(70));

        const folio = `VENTA-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        const saleData = {
            niche: niche._id,
            customer: customer._id,
            folio,
            totalAmount,
            downPayment,
            balance,
            monthsToPay: months,
            amortizationTable,
            status: 'active'
        };

        console.log('   Generando contrato de venta...');
        const sale = await Sale.create([saleData], { session });
        const createdSale = sale[0];

        console.log('   ✅ Venta registrada exitosamente');
        console.log('');
        console.log('   Folio:          ' + createdSale.folio);
        console.log('   Fecha:          ' + createdSale.createdAt.toLocaleString('es-MX'));
        console.log('   ID de Venta:    ' + createdSale._id);

        // ========================================
        // PASO 5: REGISTRAR PAGO INICIAL
        // ========================================
        console.log('\n💳 PASO 5: REGISTRO DE PAGO INICIAL');
        console.log('─'.repeat(70));

        const receiptNumber = `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        const paymentData = {
            sale: createdSale._id,
            customer: customer._id,
            receiptNumber,
            amount: downPayment,
            concept: 'down_payment',
            method: 'cash',
            paymentDate: new Date()
        };

        console.log('   Procesando pago de enganche...');
        const payment = await Payment.create([paymentData], { session });
        const createdPayment = payment[0];

        console.log('   ✅ Pago registrado exitosamente');
        console.log('');
        console.log('   Recibo:         ' + createdPayment.receiptNumber);
        console.log('   Monto:          ' + formatMoney(createdPayment.amount));
        console.log('   Método:         ' + (createdPayment.method === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'));
        console.log('   Fecha:          ' + createdPayment.paymentDate.toLocaleString('es-MX'));
        console.log('   ID de Pago:     ' + createdPayment._id);

        // ========================================
        // PASO 6: ACTUALIZAR NICHO
        // ========================================
        console.log('\n🔄 PASO 6: ACTUALIZACIÓN DE NICHO');
        console.log('─'.repeat(70));

        console.log('   Marcando nicho como vendido...');

        await Niche.updateOne(
            { _id: niche._id },
            {
                status: 'sold',
                currentOwner: customer._id,
                notes: `Vendido - Contrato: ${folio}`,
                $set: { updatedAt: new Date() }
            },
            { session }
        );

        console.log('   ✅ Nicho actualizado exitosamente');
        console.log('');
        console.log('   Código:         ' + niche.code);
        console.log('   Estado:         available → sold');
        console.log('   Propietario:    ' + customer.firstName + ' ' + customer.lastName);

        // ========================================
        // PASO 7: CONFIRMAR TRANSACCIÓN
        // ========================================
        console.log('\n✅ PASO 7: CONFIRMACIÓN DE TRANSACCIÓN');
        console.log('─'.repeat(70));

        await session.commitTransaction();
        console.log('   ✅ Todos los cambios confirmados exitosamente');

        // ========================================
        // RESUMEN FINAL
        // ========================================
        console.log('\n');
        console.log('═'.repeat(70));
        console.log('🎉 VENTA COMPLETADA EXITOSAMENTE'.padStart(50));
        console.log('═'.repeat(70));
        console.log('');
        console.log('📊 RESUMEN DE LA TRANSACCIÓN:');
        console.log('');
        console.log('   Cliente:        ' + customer.firstName + ' ' + customer.lastName);
        console.log('   Teléfono:       ' + customer.phone);
        console.log('');
        console.log('   Nicho:          ' + niche.code + ' (#' + niche.displayNumber + ')');
        console.log('   Ubicación:      Módulo ' + niche.module + ', Sección ' + niche.section);
        console.log('   Tipo:           ' + (niche.type === 'wood' ? '🪵 Madera' : '💎 Mármol'));
        console.log('');
        console.log('   Contrato:       ' + folio);
        console.log('   Recibo:         ' + receiptNumber);
        console.log('');
        console.log('   Precio Total:   ' + formatMoney(totalAmount));
        console.log('   Enganche:       ' + formatMoney(downPayment) + ' (' + SALE_CONFIG.downPaymentPercentage + '%)');
        console.log('   Saldo:          ' + formatMoney(balance));
        console.log('');
        console.log('   Plazo:          ' + months + ' meses');
        console.log('   Mensualidad:    ' + formatMoney(monthlyPayment));
        console.log('   Próximo Pago:   ' + amortizationTable[0].dueDate.toLocaleDateString('es-MX'));
        console.log('');
        console.log('═'.repeat(70));
        console.log('');

        // ========================================
        // DATOS PARA TESTING
        // ========================================
        console.log('📝 DATOS PARA PRUEBAS EN API:');
        console.log('');
        console.log('   GET /api/sales/' + createdSale._id);
        console.log('   GET /api/customers/' + customer._id);
        console.log('   GET /api/niches/' + niche._id);
        console.log('');
        console.log('   Para registrar el siguiente pago mensual:');
        console.log('   POST /api/sales/' + createdSale._id + '/payment');
        console.log('   Body: {');
        console.log('     "amount": ' + monthlyPayment + ',');
        console.log('     "method": "cash",');
        console.log('     "paymentNumber": 1');
        console.log('   }');
        console.log('');
        console.log('═'.repeat(70));
        console.log('');

    } catch (error) {
        console.error('\n❌ ERROR EN LA PRUEBA:');
        console.error('   ' + error.message);
        console.error('');

        if (error.stack) {
            console.error('Stack trace:');
            console.error(error.stack);
        }

        try {
            await session.abortTransaction();
            console.log('🔄 Transacción revertida exitosamente');
        } catch (abortError) {
            console.error('❌ Error al revertir transacción:', abortError.message);
        }

    } finally {
        try {
            session.endSession();
            await mongoose.connection.close();
            console.log('🔌 Conexión cerrada\n');
        } catch (closeError) {
            console.error('❌ Error al cerrar conexión:', closeError.message);
        }
    }
};