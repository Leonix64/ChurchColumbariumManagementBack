// src/scripts/seed-admin.js - VERSIÓN CORREGIDA
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Añade bcrypt
const User = require('../modules/auth/models/user.model');

// Configurar para evitar advertencias
mongoose.set('strictQuery', true);

const createAdminUser = async () => {
    try {
        console.log('👑 CONECTANDO A MONGODB ATLAS...\n');

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log('✅ Conectado a MongoDB Atlas\n');

        // Verificar si ya existe un admin
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('⚠️  YA EXISTE UN USUARIO ADMINISTRADOR:');
            console.log(`   Usuario: ${existingAdmin.username}`);
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   ID: ${existingAdmin._id}`);
            console.log('\n📋 Para crear otro admin, usa:');
            console.log('   POST /api/auth/register');
            console.log('\n📌 O elimina el usuario existente manualmente.');

            await mongoose.disconnect();
            return;
        }

        // Encriptar password manualmente
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Admin123!', salt);

        // Crear usuario admin
        const adminData = {
            username: 'admin',
            email: 'admin@columbario.com',
            password: hashedPassword, // Password ya encriptado
            fullName: 'Administrador Principal',
            role: 'admin',
            isActive: true
        };

        console.log('👨‍💼 CREANDO USUARIO ADMINISTRADOR...\n');
        console.log('📝 DATOS DEL ADMINISTRADOR:');
        console.log(`   • Usuario: ${adminData.username}`);
        console.log(`   • Email: ${adminData.email}`);
        console.log(`   • Contraseña: Admin123! (cambia después)`);
        console.log(`   • Rol: ${adminData.role}`);
        console.log('\n⚠️  ¡IMPORTANTE! Cambia la contraseña después del primer login.\n');

        // Guardar usuario (sin middleware pre-save)
        await User.create(adminData);

        console.log('✅ ¡USUARIO ADMIN CREADO EXITOSAMENTE!\n');
        console.log('📋 CREDENCIALES DE ACCESO:');
        console.log(`   🔗 URL: http://localhost:${process.env.PORT || 3000}`);
        console.log(`   👤 Usuario: admin`);
        console.log(`   🔑 Contraseña: Admin123!`);
        console.log('\n🎯 ENDPOINTS DISPONIBLES:');
        console.log('   POST /api/auth/login     - Iniciar sesión');
        console.log('   POST /api/auth/change-password - Cambiar contraseña');

        // Mostrar ejemplo de login
        console.log('\n📝 EJEMPLO DE LOGIN:');
        console.log('   Method: POST');
        console.log('   URL: http://localhost:3000/api/auth/login');
        console.log('   Body (JSON):');
        console.log(JSON.stringify({
            username: 'admin',
            password: 'Admin123!'
        }, null, 2));

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR AL CREAR ADMIN:', error.message);

        if (error.code === 11000) {
            console.log('\n⚠️  El usuario o email ya existen en la base de datos.');
        }

        process.exit(1);
    }
};

// Ejecutar sin input interactivo
createAdminUser();