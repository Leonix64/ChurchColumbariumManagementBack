require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../modules/auth/models/user.model');
const config = require('../config/env');

mongoose.set('strictQuery', true);

const createInitialUsers = async () => {
    try {
        console.log('[INFO] Conectando a MongoDB Atlas...\n');

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log('[SUCCESS] Conectado a MongoDB Atlas\n');

        // Verificar si ya existen usuarios
        const existingUsers = await User.find({});

        if (existingUsers.length > 0) {
            console.log('[WARNING] Ya existen usuarios en la base de datos:');
            existingUsers.forEach(u => {
                console.log(`  • ${u.username} (${u.role}) - ${u.email}`);
            });
            console.log('\n[INFO] Para recrear usuarios:');
            console.log('  1. Elimina los usuarios existentes desde MongoDB Atlas');
            console.log('  2. Ejecuta: npm run seed:users\n');
            await mongoose.disconnect();
            return;
        }

        console.log('='.repeat(70));
        console.log('CREANDO USUARIOS INICIALES DEL SISTEMA');
        console.log('='.repeat(70));
        console.log('');

        const users = [
            {
                username: 'admin',
                email: 'admin@columbario.com',
                password: 'Admin123!',
                fullName: 'Administrador del Sistema',
                phone: '4491234567',
                role: 'admin',
                isActive: true,
                tokenVersion: 0
            },
            {
                username: 'seller01',
                email: 'seller01@columbario.com',
                password: 'Seller123!',
                fullName: 'María González Pérez',
                phone: '4497654321',
                role: 'seller',
                isActive: true,
                tokenVersion: 0
            },
            {
                username: 'viewer01',
                email: 'viewer01@columbario.com',
                password: 'Viewer123!',
                fullName: 'Roberto Martínez López',
                phone: '4498765432',
                role: 'viewer',
                isActive: true,
                tokenVersion: 0
            }
        ];

        console.log('[INFO] Creando usuarios...\n');

        const createdUsers = [];

        for (const userData of users) {
            const user = await User.create(userData);
            createdUsers.push(user);
            console.log(`✅ Usuario creado: ${user.username} (${user.role})`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('USUARIOS CREADOS EXITOSAMENTE');
        console.log('='.repeat(70));
        console.log('');

        console.log('📋 CREDENCIALES DE ACCESO:\n');

        createdUsers.forEach((user, index) => {
            const originalPassword = users[index].password;
            console.log(`${index + 1}. ${user.role.toUpperCase()}`);
            console.log('   ─'.repeat(35));
            console.log(`   Nombre:     ${user.fullName}`);
            console.log(`   Usuario:    ${user.username}`);
            console.log(`   Email:      ${user.email}`);
            console.log(`   Contraseña: ${originalPassword}`);
            console.log(`   Teléfono:   ${user.phone}`);
            console.log(`   ID:         ${user._id}`);
            console.log('');
        });

        console.log('='.repeat(70));
        console.log('PERMISOS POR ROL:');
        console.log('='.repeat(70));
        console.log('');

        console.log('👑 ADMIN:');
        console.log('   • Acceso total al sistema');
        console.log('   • Crear, editar y eliminar usuarios');
        console.log('   • Gestionar todos los módulos');
        console.log('   • Ver logs de auditoría');
        console.log('   • Configuración del sistema');
        console.log('');

        console.log('💼 SELLER (Vendedor):');
        console.log('   • Registrar ventas');
        console.log('   • Gestionar clientes');
        console.log('   • Registrar pagos');
        console.log('   • Ver información de nichos');
        console.log('   • Registrar mantenimientos');
        console.log('');

        console.log('👁️  VIEWER (Consulta):');
        console.log('   • Solo lectura de información');
        console.log('   • Ver clientes');
        console.log('   • Ver ventas');
        console.log('   • Ver nichos');
        console.log('   • NO puede modificar datos');
        console.log('');

        console.log('='.repeat(70));
        console.log('EJEMPLO DE LOGIN:');
        console.log('='.repeat(70));
        console.log('');
        console.log(`POST http://localhost:${config.server.port}/api/auth/login`);
        console.log('Content-Type: application/json\n');
        console.log(JSON.stringify({
            username: 'admin',
            password: 'Admin123!'
        }, null, 2));
        console.log('');

        console.log('='.repeat(70));
        console.log('⚠️  IMPORTANTE - SEGURIDAD:');
        console.log('='.repeat(70));
        console.log('');
        console.log('1. CAMBIA TODAS LAS CONTRASEÑAS después del primer login');
        console.log('   Endpoint: POST /api/auth/change-password');
        console.log('');
        console.log('2. Guarda las credenciales en un lugar seguro');
        console.log('');
        console.log('3. NO compartas estas contraseñas por medios inseguros');
        console.log('');
        console.log('4. Actualiza las variables de entorno en .env:');
        console.log('   ADMIN_PASSWORD=<nueva_contraseña_segura>');
        console.log('');

        console.log('='.repeat(70));
        console.log('');

        await mongoose.disconnect();
        console.log('[INFO] Conexión cerrada\n');
        process.exit(0);

    } catch (error) {
        console.error('\n[ERROR] Error al crear usuarios:', error.message);

        if (error.code === 11000) {
            console.log('\n[CONFLICT] Ya existe un usuario con ese username o email');
            console.log('[SOLUTION] Elimina los usuarios existentes desde MongoDB Atlas');
        }

        if (error.name === 'ValidationError') {
            console.log('\n[VALIDATION ERROR]');
            Object.values(error.errors).forEach(err => {
                console.log(`  • ${err.path}: ${err.message}`);
            });
        }

        await mongoose.disconnect();
        process.exit(1);
    }
};

createInitialUsers();