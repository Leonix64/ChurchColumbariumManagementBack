require('dotenv').config();
const mongoose = require('mongoose');

// Conectar a la base de datos
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('âœ… Conectado a MongoDB Atlas');

        // Intentar registrar el modelo Deceased
        try {
            // Importar el modelo
            const Deceased = require('../../modules/niche/models/deceased.model');
            console.log('âœ… Modelo Deceased importado correctamente');

            // Verificar si estÃ¡ registrado
            if (mongoose.models['Deceased']) {
                console.log('âœ… Modelo "Deceased" registrado en Mongoose');
                console.log('   Nombre:', mongoose.models['Deceased'].modelName);
            } else {
                console.log('âŒ Modelo "Deceased" NO estÃ¡ en mongoose.models');
            }

            process.exit(0);
        } catch (error) {
            console.error('âŒ Error al importar el modelo:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('âŒ Error de conexiÃ³n:', err.message);
        process.exit(1);
    });
