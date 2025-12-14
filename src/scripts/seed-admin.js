require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../modules/auth/models/user.model');
const config = require('../config/env');

mongoose.set('strictQuery', true);

const createAdminUser = async () => {
    try {
        console.log('[INFO] Connecting to MongoDB Atlas...\n');

        await mongoose.connect(config.db.uri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log('[SUCCESS] Connected to MongoDB Atlas\n');

        const existingAdmin = await User.findOne({ username: 'admin' });

        if (existingAdmin) {
            console.log('[WARNING] Admin user already exists:');
            console.log(`  Username: ${existingAdmin.username}`);
            console.log(`  Email: ${existingAdmin.email}`);
            console.log(`  ID: ${existingAdmin._id}`);
            console.log('\n[INFO] To create another admin:');
            console.log('  - Use POST /api/auth/register as admin');
            console.log('\n[INFO] To recreate admin:');
            console.log('  1. Delete existing user from MongoDB Atlas');
            console.log('  2. Run: npm run seed:admin\n');
            await mongoose.disconnect();
            return;
        }

        const plainPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@columbario.com';
        const adminFullName = process.env.ADMIN_FULLNAME || 'System Administrator';

        console.log('[INFO] Creating administrator user...\n');
        console.log('Admin Details:');
        console.log(`  Username: ${adminUsername}`);
        console.log(`  Email: ${adminEmail}`);
        console.log(`  Password: ${plainPassword} ${plainPassword === 'Admin123!' ? '(CHANGE AFTER LOGIN)' : ''}`);
        console.log(`  Role: admin`);
        console.log('\n[IMPORTANT] Change password after first login.\n');

        const adminData = {
            username: adminUsername,
            email: adminEmail,
            password: plainPassword,
            fullName: adminFullName,
            role: 'admin',
            isActive: true,
            tokenVersion: 0
        };

        await User.create(adminData);

        console.log('[SUCCESS] Admin user created successfully!\n');
        console.log('Access Credentials:');
        console.log(`  URL: http://localhost:${config.server.port}`);
        console.log(`  Username: ${adminUsername}`);
        console.log(`  Password: ${plainPassword}`);
        console.log('\nAvailable Endpoints:');
        console.log('  POST /api/auth/login - Login');
        console.log('  POST /api/auth/change-password - Change password');
        console.log('  GET  /api/auth/admin/users - List users');

        console.log('\nLogin Example:');
        console.log('  Method: POST');
        console.log(`  URL: http://localhost:${config.server.port}/api/auth/login`);
        console.log('  Body:');
        console.log(JSON.stringify({
            username: adminUsername,
            password: plainPassword
        }, null, 2));

        console.log('\n[SECURITY]');
        console.log('  1. Login immediately');
        console.log('  2. Change password via /api/auth/change-password');
        console.log('  3. Update ADMIN_PASSWORD in .env\n');

        await mongoose.disconnect();
        console.log('[INFO] Connection closed\n');
        process.exit(0);

    } catch (error) {
        console.error('\n[ERROR] Failed to create admin:', error.message);

        if (error.code === 11000) {
            console.log('\n[CONFLICT] Username or email already exists');
            console.log('[SOLUTION] Delete existing user from MongoDB Atlas');
        }

        if (error.name === 'ValidationError') {
            console.log('\n[VALIDATION ERROR]');
            Object.values(error.errors).forEach(err => {
                console.log(`  - ${err.path}: ${err.message}`);
            });
        }

        await mongoose.disconnect();
        process.exit(1);
    }
};

createAdminUser();
