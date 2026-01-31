const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const connectDB = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Conectar a MongoDB Atlas
connectDB();

// Middlewares (CORS y JSON)
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Para manejar cookies

setImmediate(() => {
    require('./modules/columbarium/models/index.model');
});

// Rutas
app.use('/api/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/audit', require('./modules/audit/routes/audit.routes'));
app.use('/api/niches', require('./modules/columbarium/routes/niche.routes'));
app.use('/api/customers', require('./modules/columbarium/routes/customer.routes'));
app.use('/api/maintenance', require('./modules/columbarium/routes/maintenance.routes'));
app.use('/api/sales', require('./modules/columbarium/routes/sale.routes'));
app.use('/api/succession', require('./modules/columbarium/routes/succession.routes'));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Church Columbarium Management API',
        version: '2.0.0',
        environment: config.server.env,
        features: [
            'JWT Authentication with Refresh Tokens',
            'Role-based Access Control (RBAC)',
            'Columbarium Niche Management',
            'Sales System with Amortization Tables',
            'Atomic Transactions for Sales',
            'Customer Management',
            'Payment Tracking'
        ],
        documentation: {
            auth: {
                login: 'POST /api/auth/login',
                register: 'POST /api/auth/register',
                profile: 'GET /api/auth/profile',
                refreshToken: 'POST /api/auth/refresh-token',
                logout: 'POST /api/auth/logout',
                changePassword: 'POST /api/auth/change-password',
                invalidateAll: 'POST /api/auth/invalidate-all',
                adminUsers: 'GET /api/auth/admin/users'
            },
            customers: {
                create: 'POST /api/customers',
                list: 'GET /api/customers',
                getById: 'GET /api/customers/:id',
                update: 'PUT /api/customers/:id',
                deactivate: 'DELETE /api/customers/:id',
                activate: 'PATCH /api/customers/:id/activate'
            },
            niches: {
                list: 'GET /api/niches',
                stats: 'GET /api/niches/stats',
                available: 'GET /api/niches/available',
                byCode: 'GET /api/niches/code/:code',
                byId: 'GET /api/niches/:id',
                update: 'PATCH /api/niches/:id'
            },
            sales: {
                create: 'POST /api/sales',
                list: 'GET /api/sales',
                getById: 'GET /api/sales/:id',
                stats: 'GET /api/sales/stats',
                registerPayment: 'POST /api/sales/:id/payment'
            }
        },
        links: {
            repository: 'https://github.com/Leonix64/ChurchColumbariumManagementBack',
            frontend: config.cors.origin
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: config.server.env,
        database: 'connected'
    });
});

// Ruta 404 (No encontrado)
app.use(notFoundHandler);

// Manejador global de errores
app.use(errorHandler);

// Servidor
const PORT = config.server.port;

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('SERVER STARTED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Environment:        ${config.server.env}`);
    console.log(`Port:               ${PORT}`);
    console.log(`URL:                http://localhost:${PORT}`);
    console.log(`API Docs:           http://localhost:${PORT}/`);
    console.log(`Health Check:       http://localhost:${PORT}/health`);
    console.log('');
    console.log(`JWT:                Configured`);
    console.log(`Database:           Connected`);
    console.log(`CORS:               ${config.cors.origin}`);
    console.log('');

    if (config.server.isDevelopment) {
        console.log('DEVELOPMENT COMMANDS:');
        console.log('  npm run seed:admin      - Create admin user');
        console.log('  npm run seed:niches     - Populate niches database');
        console.log('  npm run seed:customers  - Create test customers');
        console.log('  npm run generate:secrets - Generate new JWT secrets');
        console.log('');
    }

    console.log('='.repeat(60));
    console.log('');
});

// Errores de promesas no manejadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Rejection at:', promise);
    console.error('[ERROR] Reason:', reason);
    if (config.server.isProduction) {
        process.exit(1);
    }
});

// Errores de excepciones no manejadas
process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught Exception:', error);
    if (config.server.isProduction) {
        process.exit(1);
    }
});
