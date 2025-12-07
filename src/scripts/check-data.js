require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/columbarium/models/customer.model');
const Niche = require('../modules/columbarium/models/niche.model');
const Sale = require('../modules/columbarium/models/sale.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado para verificación...'))
    .catch(err => console.error(err));

const checkData = async () => {
    try {
        console.log('🔍 VERIFICANDO DATOS EN LA BASE\n');

        // Contar registros
        const customerCount = await Customer.countDocuments();
        const nicheCount = await Niche.countDocuments();
        const saleCount = await Sale.countDocuments();

        console.log(`👥 Clientes: ${customerCount}`);
        console.log(`🏛️ Nichos: ${nicheCount}`);
        console.log(`💰 Ventas: ${saleCount}`);

        // Mostrar estadísticas de nichos
        const nichesByStatus = await Niche.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        console.log('\n📊 ESTADO DE NICHOS:');
        nichesByStatus.forEach(s => {
            console.log(`  ${s._id}: ${s.count}`);
        });

        // Nichos por material
        const nichesByType = await Niche.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);

        console.log('\n🏗️ NICHOS POR MATERIAL:');
        nichesByType.forEach(t => {
            console.log(`  ${t._id}: ${t.count}`);
        });

        // Mostrar algunos nichos disponibles
        console.log('\n🎯 5 NICHOS DISPONIBLES (ejemplo):');
        const availableNiches = await Niche.find({ status: 'available' })
            .limit(5)
            .select('code displayNumber type price');

        availableNiches.forEach(n => {
            console.log(`  ${n.code} - #${n.displayNumber} (${n.type}): $${n.price}`);
        });

        // Si hay ventas, mostrar info
        if (saleCount > 0) {
            console.log('\n📈 VENTAS REGISTRADAS:');
            const sales = await Sale.find({})
                .populate('customer', 'firstName lastName')
                .populate('niche', 'code');

            sales.forEach(s => {
                console.log(`  Folio: ${s.folio}`);
                console.log(`  Cliente: ${s.customer.firstName} ${s.customer.lastName}`);
                console.log(`  Nicho: ${s.niche.code}`);
                console.log(`  Total: $${s.totalAmount}`);
                console.log(`  ---`);
            });
        }

        process.exit();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkData();
