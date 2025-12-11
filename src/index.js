const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Conectar a MongoDB Atlas
connectDB();

// Middlewares (CORS y JSON)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true // Permitir cookies
}));
app.use(express.json());
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
        message: '🏛️ API del Sistema de Columbario',
        version: '2.0.0',
        features: ['Autenticación JWT', 'Refresh Tokens', 'Roles de usuario'],
        endpoints: {
            auth: {
                login: 'POST /api/auth/login',
                register: 'POST /api/auth/register',
                profile: 'GET /api/auth/profile',
                refresh: 'POST /api/auth/refresh-token',
                logout: 'POST /api/auth/logout'
            },
            nichos: {
                all: 'GET /api/niches',
                byCode: 'GET /api/niches/code/:code',
                update: 'PATCH /api/niches/:id'
            },
            clientes: {
                create: 'POST /api/customers',
                search: 'GET /api/customers?search=texto'
            },
            ventas: {
                create: 'POST /api/sales'
            }
        }
    });
});

// Ruta 404 (No encontrado)
app.use('', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    // Errores de JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expirado'
        });
    }

    // Error general
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});
// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    SERVIDOR INICIADO
    ====================
    URL: http://localhost:${PORT}
    PI Docs: http://localhost:${PORT}/
    
    Para crear usuario admin: npm run seed:admin
    Para datos de prueba: npm run seed:niches && npm run seed:customers
    
    Sistema de autenticación JWT activo
    Refresh tokens configurados
    `);
});