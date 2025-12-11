const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    // Datos de identificación
    username: {
        type: String,
        required: [true, 'El nombre de usuario es requerido'],
        unique: true,
        trim: true,
        minlength: [3, 'El usuario debe tener al menos 3 caracteres'],
        index: true
    },

    email: {
        type: String,
        required: [true, 'El email es requerido'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor ingresa un email válido'],
        index: true
    },

    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
        select: false
    },

    // Información personal
    fullName: {
        type: String,
        required: [true, 'El nombre completo es requerido'],
        trim: true
    },

    phone: {
        type: String,
        trim: true
    },

    // Roles y permisos
    role: {
        type: String,
        enum: ['admin', 'seller', 'viewer'],
        default: 'seller',
        required: true,
        index: true
    },

    // Estado de la cuenta
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // Token versioning
    tokenVersion: {
        type: Number,
        default: 0
    },

    // Último login
    lastLogin: {
        type: Date
    },

    // Intentos fallidos
    loginAttempts: {
        type: Number,
        default: 0
    },

    // Bloqueo temporal
    lockUntil: {
        type: Date
    }

}, {
    timestamps: true,
    versionKey: false
});

// Método para encriptar password (llamado manualmente)
UserSchema.methods.encryptPassword = async function (password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

// Método para comparar passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Método para generar JWT
UserSchema.methods.generateAccessToken = function () {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        {
            id: this._id,
            username: this.username,
            email: this.email,
            role: this.role,
            tokenVersion: this.tokenVersion
        },
        process.env.JWT_ACCESS_SECRET || 'access_secret',
        { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
    );
};

// Método para generar Refresh Token
UserSchema.methods.generateRefreshToken = function () {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        {
            id: this._id,
            tokenVersion: this.tokenVersion
        },
        process.env.JWT_REFRESH_SECRET || 'refresh_secret',
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );
};

// Método para incrementar tokenVersion
UserSchema.methods.invalidateTokens = async function () {
    this.tokenVersion += 1;
    return this.save();
};

// Propiedad virtual para verificar si la cuenta está bloqueada
UserSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model('User', UserSchema);