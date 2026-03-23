const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const connectDB = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { generalLimiter, authLimiter } = require('./config/rateLimiters');

const app = express();

// Conectar a MongoDB Atlas
connectDB();

// Middlewares (CORS y JSON)
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Para manejar cookies

require('./modules/columbarium/models/index.model');

// Aplicar rate limiters
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);

// Rutas
app.use('/api/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/audit', require('./modules/audit/routes/audit.routes'));
app.use('/api/niches', require('./modules/columbarium/routes/niche.routes'));
app.use('/api/customers', require('./modules/columbarium/routes/customer.routes'));
app.use('/api/maintenance', require('./modules/columbarium/routes/maintenance.routes'));
app.use('/api/sales', require('./modules/columbarium/routes/sale.routes'));
app.use('/api/succession', require('./modules/columbarium/routes/succession.routes'));
app.use('/api/beneficiaries', require('./modules/columbarium/routes/beneficiary.routes'));

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
            frontend: config.cors.allowedOrigins[0]
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
    const I = 53;
    const row = (s = '') => `│ ${s.padEnd(I - 1)}│`;
    const sep = `├${'─'.repeat(I)}┤`;
    const top = `┌${'─'.repeat(I)}┐`;
    const bot = `└${'─'.repeat(I)}┘`;
    const center = (s) => {
        const l = Math.floor((I - s.length) / 2);
        return `│${' '.repeat(l)}${s}${' '.repeat(I - s.length - l)}│`;
    };

    const corsRows = config.cors.allowedOrigins
        .map((url, i) => row(i === 0 ? `CORS        ${url}` : `            ${url}`))
        .join('\n');

    console.log([
        '',
        top,
        center('ChurchSystem API  ·  v2.0.0'),
        sep,
        row(`Env         ${config.server.env}`),
        row(`Running     http://localhost:${PORT}`),
        row(`Health      http://localhost:${PORT}/health`),
        row(`Database    MongoDB Atlas · connected`),
        sep,
        corsRows,
        bot,
        ''
    ].join('\n'));
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
