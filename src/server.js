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
    require('./modules/columbarium/models/customer.model');
    require('./modules/columbarium/models/deceased.model');
    require('./modules/columbarium/models/niche.model');
    require('./modules/columbarium/models/sale.model');
    require('./modules/columbarium/models/payment.model');
    console.log('■ Modelos registrados correctamente');
});

// Rutas
app.use('/api/auth', require('./modules/auth/routes/auth.routes'));
app.use('/api/niches', require('./modules/columbarium/routes/niche.routes'));
app.use('/api/customers', require('./modules/columbarium/routes/customer.routes'));
app.use('/api/sales', require('./modules/columbarium/routes/sale.routes'));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'API del Sistema de Columbario',
        version: '2.0.0',
        environment: config.server.env,
        features: [
            'Autenticación JWT con Refresh Tokens',
            'Sistema de roles (admin/seller/viewer)',
            'Gestión de nichos de columbario',
            'Sistema de ventas con amortización',
            'Transacciones atómicas'
        ],
        documentation: {
            auth: {
                login: 'POST /api/auth/login',
                register: 'POST /api/auth/register',
                profile: 'GET /api/auth/profile',
                refreshToken: 'POST /api/auth/refresh-token',
                logout: 'POST /api/auth/logout',
                changePassword: 'POST /api/auth/change-password'
            },
            niches: {
                list: 'GET /api/niches',
                byCode: 'GET /api/niches/code/:code',
                update: 'PATCH /api/niches/:id'
            },
            customers: {
                create: 'POST /api/customers',
                search: 'GET /api/customers?search=texto'
            },
            sales: {
                create: 'POST /api/sales'
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
        uptime: process.uptime()
    });
});

// Ruta 404 (No encontrado)
app.use(notFoundHandler);

// Manejador global de errores
app.use(errorHandler);

// Servidor
const PORT = config.server.port;

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 SERVIDOR INICIADO EXITOSAMENTE');
    console.log('='.repeat(50));
    console.log(`\n📍 URL Local:        http://localhost:${PORT}`);
    console.log(`📍 API Docs:         http://localhost:${PORT}/`);
    console.log(`📍 Health Check:     http://localhost:${PORT}/health`);
    console.log(`\n🌍 Entorno:          ${config.server.env}`);
    console.log(`🔐 JWT Configurado:  ✅`);
    console.log(`🗄️  Base de Datos:    ✅`);
    console.log(`🌐 CORS Habilitado:  ${config.cors.origin}`);

    if (config.server.isDevelopment) {
        console.log('\n📝 COMANDOS ÚTILES:');
        console.log('   npm run seed:admin      - Crear usuario admin');
        console.log('   npm run seed:niches     - Crear nichos de prueba');
        console.log('   npm run seed:customers  - Crear clientes de prueba');
        console.log('   npm run generate:secrets - Generar nuevos secretos JWT');
    }

    console.log('\n' + '='.repeat(50) + '\n');
});

// Errores de promesas no manejadas
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    // En producción, considera cerrar el servidor gracefully
    if (config.server.isProduction) {
        process.exit(1);
    }
});

// Errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // En producción, cierra el servidor
    if (config.server.isProduction) {
        process.exit(1);
    }
});

module.exports = app;
