const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Se conecta a la URI de MongoDB Atlas
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // 5 segundos para conexión
            socketTimeoutMS: 45000, // 45 segundos para operaciones
        });

        console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
        console.log(`Database: ${conn.connection.name}`);
    } catch (error) {
        console.error(`Connection Error: ${error.message}`);
        process.exit(1); // Detiene la app si no hay base de datos
    }
};

module.exports = connectDB;
