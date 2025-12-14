require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../modules/columbarium/models/customer.model');
const Niche = require('../modules/columbarium/models/niche.model');
const Sale = require('../modules/columbarium/models/sale.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Connected to database for verification...'))
    .catch(err => {
        console.error('[ERROR]', err);
        process.exit(1);
    });

const checkData = async () => {
    try {
        console.log('');
        console.log('='.repeat(60));
        console.log('DATABASE VERIFICATION');
        console.log('='.repeat(60));
        console.log('');

        // Count records
        const customerCount = await Customer.countDocuments();
        const nicheCount = await Niche.countDocuments();
        const saleCount = await Sale.countDocuments();

        console.log('RECORD COUNTS:');
        console.log(`  Customers: ${customerCount}`);
        console.log(`  Niches:    ${nicheCount}`);
        console.log(`  Sales:     ${saleCount}`);
        console.log('');

        // Niche statistics by status
        const nichesByStatus = await Niche.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('NICHES BY STATUS:');
        nichesByStatus.forEach(s => {
            console.log(`  ${s._id.padEnd(12)}: ${s.count}`);
        });
        console.log('');

        // Niche statistics by type
        const nichesByType = await Niche.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('NICHES BY TYPE:');
        nichesByType.forEach(t => {
            console.log(`  ${t._id.padEnd(12)}: ${t.count}`);
        });
        console.log('');

        // Show some available niches
        if (nicheCount > 0) {
            console.log('AVAILABLE NICHES (sample of 5):');
            const availableNiches = await Niche.find({ status: 'available' })
                .limit(5)
                .select('code displayNumber type price');

            if (availableNiches.length > 0) {
                availableNiches.forEach(n => {
                    console.log(`  ${n.code.padEnd(12)} - #${String(n.displayNumber).padEnd(4)} (${n.type.padEnd(8)}): $${n.price.toLocaleString()}`);
                });
            } else {
                console.log('  No available niches found');
            }
            console.log('');
        }

        // Show sales information
        if (saleCount > 0) {
            console.log('REGISTERED SALES:');
            const sales = await Sale.find({})
                .populate('customer', 'firstName lastName')
                .populate('niche', 'code')
                .limit(10);

            sales.forEach(s => {
                console.log(`  Folio:    ${s.folio}`);
                console.log(`  Customer: ${s.customer.firstName} ${s.customer.lastName}`);
                console.log(`  Niche:    ${s.niche.code}`);
                console.log(`  Total:    $${s.totalAmount.toLocaleString()}`);
                console.log(`  Status:   ${s.status}`);
                console.log('  ---');
            });
            console.log('');
        }

        // Show customer information
        if (customerCount > 0) {
            console.log('CUSTOMERS (sample of 5):');
            const customers = await Customer.find({ active: true })
                .limit(5)
                .select('firstName lastName phone email');

            customers.forEach(c => {
                console.log(`  ${c.firstName} ${c.lastName}`);
                console.log(`    Phone: ${c.phone}`);
                if (c.email) console.log(`    Email: ${c.email}`);
                console.log('');
            });
        }

        console.log('='.repeat(60));
        console.log('VERIFICATION COMPLETED');
        console.log('='.repeat(60));
        console.log('');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('[ERROR]', error);
        await mongoose.disconnect();
        process.exit(1);
    }
};

checkData();
