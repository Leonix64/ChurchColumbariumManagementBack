const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../../../config/env');

const UserSchema = new mongoose.Schema({
    // Datos de identificación
    username: {
        type: String,
        required: [true, 'El nombre de usuario es requerido'],
        unique: true,
        trim: true,
        minlength: [3, 'El usuario debe tener al menos 3 caracteres'],
        maxlength: [30, 'El usuario no puede tener más de 30 caracteres'],
        match: [/^[a-zA-Z0-9_]+$/, 'El usuario solo puede contener letras, numeros y guiones bajos'],
        index: true
    },

    email: {
        type: String,
        required: [true, 'El email es requerido'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor ingresa un email valido'],
        index: true
    },

    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
        select: false // No incluir password en queries por defecto
    },

    // Información personal
    fullName: {
        type: String,
        required: [true, 'El nombre completo es requerido'],
        trim: true,
        minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
        maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
    },

    phone: {
        type: String,
        trim: true,
        match: [/^[0-9]{10}$/, 'Telefono invalido (debe tener 10 digitos)']
    },

    // Roles y permisos
    role: {
        type: String,
        enum: {
            values: ['admin', 'seller', 'viewer'],
            message: 'Rol invalido. Debe ser: admin, seller o viewer'
        },
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

    // Token versioning (para invalidar tokens globalmente)
    tokenVersion: {
        type: Number,
        default: 0,
        select: false // No exponer en queries normales
    },

    // Refresh token actual (para seguridad)
    refreshToken: {
        type: String,
        select: false // No exponer
    },

    // Ultimo login
    lastLogin: {
        type: Date
    },

    // Control de intentos fallidos
    loginAttempts: {
        type: Number,
        default: 0,
        select: false
    },

    // Bloqueo temporal
    lockUntil: {
        type: Date,
        select: false
    }

}, {
    timestamps: true,
    versionKey: false
});

/* Método para encriptar password (llamado manualmente)
UserSchema.methods.encryptPassword = async function (password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};*/

// Metodo para comparar passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Error al comparar contraseñas');
    }
};

// Metodo para generar Access Token (JWT de corta duracion)
UserSchema.methods.generateAccessToken = function () {
    const jwt = require('jsonwebtoken');

    // VALIDACION: Asegurar que existe el secreto
    if (!config.jwt.accessSecret) {
        throw new Error('JWT_ACCESS_SECRET no configurado en variables de entorno');
    }

    return jwt.sign(
        {
            id: this._id,
            username: this.username,
            email: this.email,
            role: this.role,
            tokenVersion: this.tokenVersion
        },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessExpire }
    );
};

// Metodo para generar Refresh Token (JWT de larga duracion)
UserSchema.methods.generateRefreshToken = function () {
    const jwt = require('jsonwebtoken');

    // VALIDACION: Asegurar que existe el secreto
    if (!config.jwt.refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET no configurado en variables de entorno');
    }

    return jwt.sign(
        {
            id: this._id,
            tokenVersion: this.tokenVersion
        },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpire }
    );
};

// Invalidar todos los tokens existentes (incrementa tokenVersion)
UserSchema.methods.invalidateTokens = async function () {
    this.tokenVersion += 1;
    this.refreshToken = undefined; // Limpiar refresh token
    return await this.save();
};

// Incrementar intentos fallidos de login
UserSchema.methods.incrementLoginAttempts = async function () {
    // Si ya esta bloqueado y el tiempo expiro, resetear
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }

    // Incrementar intentos
    const updates = { $inc: { loginAttempts: 1 } };

    // Bloquear después de 5 intentos fallidos (2 horas)
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
    }

    return await this.updateOne(updates);
};

// Resetear intentos fallidos
UserSchema.methods.resetLoginAttempts = async function () {
    return await this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

/**
 * PROPIEDADES VIRTUALES
 */

// Verificar si la cuenta esta bloqueada
UserSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save: Encriptar password si fue modificado
UserSchema.pre('save', async function (next) {
    // Solo encriptar si el password fue modificado
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save: Limpiar espacios en username y email
UserSchema.pre('save', function (next) {
    if (this.username) {
        this.username = this.username.trim().toLowerCase();
    }
    if (this.email) {
        this.email = this.email.trim().toLowerCase();
    }
    next();
});

// Para busquedas eficientes
UserSchema.index({ username: 1, isActive: 1 });
UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model('User', UserSchema);