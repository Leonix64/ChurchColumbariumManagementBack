/**
 * CONEXIÓN A BASE DE DATOS
 * Establece conexión con MongoDB Atlas usando Mongoose
 */
const mongoose = require('mongoose');

/**
 * Conecta a MongoDB Atlas
 * Termina el proceso si la conexión falla
 */
const connectDB = async () => {
    try {
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
