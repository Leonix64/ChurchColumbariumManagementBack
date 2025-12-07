const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Conectar a MongoDB Atlas
connectDB();

// Middlewares (CORS y JSON)
app.use(cors());
app.use(express.json());

setImmediate(() => {
    require('./modules/columbarium/models/index.model');
})

// Rutas
app.use('/api/niches', require('./modules/columbarium/routes/niche.routes'));
app.use('/api/customers', require('./modules/columbarium/routes/customer.routes'));
app.use('/api/sales', require('./modules/columbarium/routes/sale.routes'));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'API del Sistema de Columbario',
        version: '1.0.0',
        endpoints: {
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
app.use('/404', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
    console.error('Error', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on: http://localhost:${PORT}`);
    console.log(`Documentacion de API: http://localhost:${PORT}/`);
});
