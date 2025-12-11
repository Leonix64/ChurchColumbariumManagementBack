const crypto = require('crypto');

console.log('🔐 GENERANDO SECRETOS SEGUROS PARA JWT\n');
console.log('='.repeat(50));

// Generar 2 secretos diferentes
const accessSecret = crypto.randomBytes(64).toString('hex');
const refreshSecret = crypto.randomBytes(64).toString('hex');

console.log('\n1. SECRETO PARA ACCESS TOKEN:');
console.log('JWT_ACCESS_SECRET=' + accessSecret);

console.log('\n2. SECRETO PARA REFRESH TOKEN:');
console.log('JWT_REFRESH_SECRET=' + refreshSecret);

console.log('\n' + '='.repeat(50));
console.log('📋 Copia estos valores en tu archivo .env');
console.log('⚠️  Nunca los compartas o los subas a GitHub');