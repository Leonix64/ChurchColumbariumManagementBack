require('dotenv').config();
const mongoose = require('mongoose');
const Niche = require('../modules/columbarium/models/niche.model');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Connected to create niches...'))
    .catch(err => console.error('[ERROR]', err));

const seedNiches = async () => {
    try {
        console.log('[INFO] Creating Module A, Section A niches...\n');

        await Niche.deleteMany({ module: 'A', section: 'A' });
        console.log('[INFO] Existing niches cleared\n');

        const niches = [];
        let globalCounter = 1;

        // 7 rows (1 = bottom, 7 = top)
        // 51 columns per row
        for (let row = 1; row <= 7; row++) {
            for (let col = 1; col <= 51; col++) {
                // Columns 44-51 are marble (last 8 of each row)
                const isMarble = col >= 44;
                const type = isMarble ? 'marble' : 'wood';
                const price = isMarble ? 35000 : 30000;

                niches.push({
                    code: `A-A-${row}-${globalCounter}`,
                    displayNumber: globalCounter,
                    module: 'A',
                    section: 'A',
                    row: row,
                    number: col,
                    type: type,
                    price: price,
                    status: 'available'
                });

                globalCounter++;
            }
        }

        await Niche.insertMany(niches);

        console.log(`[SUCCESS] ${niches.length} niches created`);
        console.log('\nSummary:');
        console.log(`  Wood: ${niches.filter(n => n.type === 'wood').length} niches`);
        console.log(`  Marble: ${niches.filter(n => n.type === 'marble').length} niches`);
        console.log(`  Code range: ${niches[0].code} to ${niches[niches.length - 1].code}`);
        console.log(`  Display range: ${niches[0].displayNumber} to ${niches[niches.length - 1].displayNumber}`);

        console.log('\nVerification examples:');
        console.log(`  Niche 1: ${niches[0].code} (row 1, col 1)`);
        console.log(`  Niche 51: ${niches[50].code} (row 1, col 51)`);
        console.log(`  Niche 52: ${niches[51].code} (row 2, col 1)`);
        console.log(`  Last niche (357): ${niches[356].code} (row 7, col 51)`);

        console.log('\n[INFO] Seed completed successfully\n');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR]', error);
        process.exit(1);
    }
};

seedNiches();
