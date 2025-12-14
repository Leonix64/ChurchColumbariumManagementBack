const crypto = require('crypto');

console.log('');
console.log('='.repeat(60));
console.log('JWT SECRET GENERATOR');
console.log('='.repeat(60));
console.log('');

// Generate 2 different secrets
const accessSecret = crypto.randomBytes(64).toString('hex');
const refreshSecret = crypto.randomBytes(64).toString('hex');

console.log('1. ACCESS TOKEN SECRET:');
console.log(`JWT_ACCESS_SECRET=${accessSecret}`);
console.log('');

console.log('2. REFRESH TOKEN SECRET:');
console.log(`JWT_REFRESH_SECRET=${refreshSecret}`);
console.log('');

console.log('='.repeat(60));
console.log('INSTRUCTIONS:');
console.log('  1. Copy these values to your .env file');
console.log('  2. Never share or commit these secrets');
console.log('  3. Use different secrets for each environment');
console.log('  4. Rotate secrets every 3-6 months');
console.log('='.repeat(60));
console.log('');