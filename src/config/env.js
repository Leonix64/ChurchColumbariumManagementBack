/**
 * CONFIGURACION Y VALIDACION DE VARIABLES DE ENTORNO
 * Centraliza y valida todas las variables antes de iniciar la app
 */

require('dotenv').config();

// Variables requeridas (criticas)
const requiredVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'MONGO_URI',
    'PORT'
];

// Variables opcionales con valores por defecto
const optionalVars = {
    JWT_ACCESS_EXPIRE: '15m',
    JWT_REFRESH_EXPIRE: '7d',
    NODE_ENV: 'development',
    FRONTEND_URL: 'http://localhost:1234'
};

/**
 * Valida que todas las variables requeridas existan
 */
const validateEnv = () => {
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        console.error('\n ERROR: Faltan variables de entorno criticas:\n');
        missing.forEach(varName => {
            console.error(`   • ${varName}`);
        });
        console.error('\n Revisa tu archivo .env');
        console.error('Usa .env.example como referencia\n');
        process.exit(1);
    }

    // Validar longitud minima de secretos JWT
    if (process.env.JWT_ACCESS_SECRET.length < 32) {
        console.error('JWT_ACCESS_SECRET debe tener al menos 32 caracteres');
        process.exit(1);
    }

    if (process.env.JWT_REFRESH_SECRET.length < 32) {
        console.error('JWT_REFRESH_SECRET debe tener al menos 32 caracteres');
        process.exit(1);
    }

    console.log('Variables de entorno validadas correctamente');
};

/**
 * Obtiene una variable de entorno
 */
const getEnv = (key, defaultValue = undefined) => {
    return process.env[key] || optionalVars[key] || defaultValue;
};

/**
 * Configuración exportada
 */
const config = {
    // JWT
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpire: getEnv('JWT_ACCESS_EXPIRE'),
        refreshExpire: getEnv('JWT_REFRESH_EXPIRE')
    },

    // Database
    db: {
        uri: process.env.MONGO_URI
    },

    // Server
    server: {
        port: parseInt(getEnv('PORT', 3000)),
        env: getEnv('NODE_ENV'),
        isDevelopment: getEnv('NODE_ENV') === 'development',
        isProduction: getEnv('NODE_ENV') === 'production'
    },

    // CORS
    cors: {
        origin: function (origin, callback) {
            const allowedOrigins = [
                getEnv('FRONTEND_URL'),
                'http://localhost:5000',
                'http://localhost:8100', // Columbarium
                // Agrega otros orígenes permitidos aquí
            ];

            // Permitir requests sin origen
            if (!origin) return callback(null, true);

            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true
    },

    // Rate Limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 100 // máximo 100 requests por ventana
    }
};

// Validar al importar este módulo
validateEnv();

module.exports = config;
