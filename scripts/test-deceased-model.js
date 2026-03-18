require('dotenv').config();
const mongoose = require('mongoose');

// Conectar a la base de datos
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Conectado a MongoDB Atlas');

        // Intentar registrar el modelo Deceased
        try {
            // Importar el modelo
            const Deceased = require('./src/modules/columbarium/models/deceased.model');
            console.log('✅ Modelo Deceased importado correctamente');

            // Verificar si está registrado
            if (mongoose.models['Deceased']) {
                console.log('✅ Modelo "Deceased" registrado en Mongoose');
                console.log('   Nombre:', mongoose.models['Deceased'].modelName);
            } else {
                console.log('❌ Modelo "Deceased" NO está en mongoose.models');
            }

            process.exit(0);
        } catch (error) {
            console.error('❌ Error al importar el modelo:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('❌ Error de conexión:', err.message);
        process.exit(1);
    });