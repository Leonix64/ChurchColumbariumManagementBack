// src/scripts/seed-admin.js - VERSIÓN CORREGIDA
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../modules/auth/models/user.model');
const config = require('../config/env');

// Configurar para evitar advertencias
mongoose.set('strictQuery', true);

const createAdminUser = async () => {
    try {
        console.log('👑 CONECTANDO A MONGODB ATLAS...\n');

        await mongoose.connect(config.db.uri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log('✅ Conectado a MongoDB Atlas\n');

        // Verificar si ya existe un admin
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            TOKEN_VERSION
            console.log('⚠️  YA EXISTE UN USUARIO ADMINISTRADOR:');
            console.log(`   Usuario: ${existingAdmin.username}`);
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   ID: ${existingAdmin._id}`);
            console.log('\n📋 Para crear otro admin, usa:');
            console.log('   POST /api/auth/register (como admin)');
            console.log('\n🔄 Para recrear el admin:');
            console.log('   1. Elimina el usuario desde MongoDB Atlas');
            console.log('   2. Ejecuta nuevamente: npm run seed:admin\n');

            await mongoose.disconnect();
            return;
        }

        // Obtener datos del .env o usar defaults
        const plainPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@columbario.com';
        const adminFullName = process.env.ADMIN_FULLNAME || 'Administrador Principal';

        console.log('👨‍💼 CREANDO USUARIO ADMINISTRADOR...\n');
        console.log('📝 DATOS DEL ADMINISTRADOR:');
        console.log(`   • Usuario: ${adminUsername}`);
        console.log(`   • Email: ${adminEmail}`);
        console.log(`   • Contraseña: ${plainPassword} ${plainPassword === 'Admin123!' ? '⚠️ (CÁMBIALA)' : ''}`);
        console.log(`   • Rol: admin`);
        console.log('\n⚠️  ¡IMPORTANTE! Cambia la contraseña después del primer login.\n');

        // ✅ CREAR USUARIO DEJANDO QUE EL MIDDLEWARE ENCRIPTE
        // No encriptamos manualmente, el pre-save lo hace
        const adminData = {
            username: adminUsername,
            email: adminEmail,
            password: plainPassword, // ⭐ Password en texto plano, el modelo lo encripta
            fullName: adminFullName,
            role: 'admin',
            isActive: true,
            tokenVersion: 0
        };

        // Crear usuario (el middleware pre-save encriptará el password)
        const admin = await User.create(adminData);

        console.log('✅ ¡USUARIO ADMIN CREADO EXITOSAMENTE!\n');
        console.log('📋 CREDENCIALES DE ACCESO:');
        console.log(`   🔗 URL: http://localhost:${config.server.port}`);
        console.log(`   👤 Usuario: ${adminUsername}`);
        console.log(`   🔑 Contraseña: ${plainPassword}`);
        console.log('\n🎯 ENDPOINTS DISPONIBLES:');
        console.log('   POST /api/auth/login           - Iniciar sesión');
        console.log('   POST /api/auth/change-password - Cambiar contraseña');
        console.log('   GET  /api/auth/admin/users     - Listar usuarios');

        // Mostrar ejemplo de login
        console.log('\n📝 EJEMPLO DE LOGIN:');
        console.log('   Method: POST');
        console.log(`   URL: http://localhost:${config.server.port}/api/auth/login`);
        console.log('   Body (JSON):');
        console.log(JSON.stringify({
            username: adminUsername,
            password: plainPassword
        }, null, 2));

        console.log('\n🔒 SEGURIDAD:');
        console.log('   1. Inicia sesión inmediatamente');
        console.log('   2. Cambia la contraseña usando /api/auth/change-password');
        console.log('   3. Actualiza ADMIN_PASSWORD en el .env\n');

        await mongoose.disconnect();
        console.log('✅ Conexión cerrada\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR AL CREAR ADMIN:', error.message);

        if (error.code === 11000) {
            console.log('\n⚠️  El usuario o email ya existen en la base de datos.');
            console.log('💡 Solución: Elimina el usuario existente desde MongoDB Atlas');
        }

        if (error.name === 'ValidationError') {
            console.log('\n⚠️  Error de validación:');
            Object.values(error.errors).forEach(err => {
                console.log(`   • ${err.path}: ${err.message}`);
            });
        }

        await mongoose.disconnect();
        process.exit(1);
    }
};

// Ejecutar
createAdminUser();