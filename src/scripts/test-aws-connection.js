require('dotenv').config();
const mongoose = require('mongoose');

console.log('🌐 Probando conexión a MongoDB Atlas en AWS...\n');

// Mostrar URI (ocultando contraseña)
const maskedURI = process.env.MONGO_URI.replace(
  /\/\/([^:]+):([^@]+)@/,
  (match, user, pass) => `//${user}:****@`
);
console.log('URI:', maskedURI);

const connectionOptions = {
  serverSelectionTimeoutMS: 10000,  // 10 segundos
  socketTimeoutMS: 45000,           // 45 segundos
  maxPoolSize: 10,                  // Conexiones máximas
  family: 4                         // Usar IPv4
};

mongoose.connect(process.env.MONGO_URI, connectionOptions)
  .then(async () => {
    console.log('\n✅ CONEXIÓN EXITOSA A AWS!');
    console.log('============================');

    const conn = mongoose.connection;
    console.log(`🔗 Host: ${conn.host}`);
    console.log(`📁 Database: ${conn.name}`);
    console.log(`📍 AWS Region: ${process.env.MONGO_URI.includes('us-east-1') ? 'N. Virginia (us-east-1)' : 'Otra región'}`);

    // Verificar que es un replica set
    const isReplicaSet = await conn.db.admin().command({ replSetGetStatus: 1 })
      .then(() => true)
      .catch(() => false);

    console.log(`🔄 Replica Set: ${isReplicaSet ? '✅ ACTIVO' : '❌ NO ACTIVO'}`);

    // Probar transacción simple
    if (isReplicaSet) {
      console.log('\n🎯 Probando transacción...');
      const session = await mongoose.startSession();

      try {
        session.startTransaction();
        console.log('   Transacción iniciada correctamente');
        await session.commitTransaction();
        console.log('   ✅ Transacciones funcionando!');
      } catch (error) {
        console.log('   ❌ Error en transacción:', error.message);
      } finally {
        session.endSession();
      }
    }

    // Mostrar stats básicos
    const collections = await conn.db.listCollections().toArray();
    console.log(`\n📊 Colecciones en la DB: ${collections.length}`);

    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ ERROR DE CONEXIÓN:', err.message);
    console.log('\n🔧 Soluciones comunes:');
    console.log('1. Verifica que el cluster esté ACTIVO (puede tardar 2-3 min)');
    console.log('2. Revisa usuario y contraseña');
    console.log('3. Agrega tu IP en "Network Access" de Atlas');
    console.log('4. Si usas VPN, desactívala temporalmente');
    process.exit(1);
  });
