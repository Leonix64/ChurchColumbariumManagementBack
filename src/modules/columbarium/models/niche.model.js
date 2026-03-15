const mongoose = require('mongoose');
const { toNumber } = require('../../../utils/decimal');

const OwnershipHistorySchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: {
        type: Date
    },
    reason: {
        type: String,
        enum: ['purchase', 'succession', 'transfer', 'inheritance'],
        required: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    },
    registeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { _id: true, timestamps: true });

/**
 * NICHO
 * Espacio físico del columbario donde se depositan urnas.
 * Tiene ubicación, precio, estado y propietario actual.
 * Mantiene historial de titularidad embebido.
 */

const NicheSchema = new mongoose.Schema({
    code: {
        type: String,
        unique: true,
        required: [true, 'El codigo es requerido'],
        index: true,
        uppercase: true,
        trim: true
    },

    // El numero pintado en la pared (Ej: 52)
    displayNumber: {
        type: Number,
        required: [true, 'El numero de display es requerido'],
        min: [1, 'El numero debe ser mayor a 0']
    },


    // Ubicación física
    module: {
        type: String,
        required: [true, 'El modulo es requerido'],
        uppercase: true,
        trim: true,
        index: true
    },

    section: {
        type: String,
        required: [true, 'La seccion es requerida'],
        uppercase: true,
        trim: true,
        index: true
    },

    row: {
        type: Number,
        required: [true, 'La fila es requerida'],
        min: [1, 'La fila debe ser mayor a 0'],
        index: true
    },

    number: {
        type: Number,
        required: [true, 'El numero es requerido'],
        min: [1, 'El numero debe ser mayor a 0']
    },

    // Caracteristicas
    type: {
        type: String,
        enum: {
            values: ['wood', 'marble', 'special'],
            message: 'Tipo invalido. Debe ser: wood, marble o special'
        },
        default: 'wood',
        required: true,
        index: true
    },

    // Precio en pesos
    price: {
        type: mongoose.Schema.Types.Decimal128,
        required: [true, 'El precio es requerido'],
        validate: {
            validator: function (v) { return toNumber(v) >= 0; },
            message: 'El precio no puede ser negativo'
        }
    },

    // Estado actual
    status: {
        type: String,
        enum: {
            values: ['available', 'reserved', 'sold', 'disabled'],
            message: 'Estado invalido. Debe ser: available, reserved, sold o disabled'
        },
        default: 'available',
        required: true,
        index: true
    },

    // Referencia al dueño actual (si está vendido)
    currentOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        index: true
    },

    // Array de ocupantes (puede ser más de una urna en el futuro)
    occupants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deceased'
    }],

    ownershipHistory: {
        type: [OwnershipHistorySchema],
        default: []
    },

    // Informacion adicional
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Las notas no pueden tener más de 500 caracteres']
    },

    disabledReason: {
        type: String,
        trim: true,
        maxlength: [500, 'El motivo no puede tener más de 500 caracteres']
    },
    disabledAt: {
        type: Date,
    },
    disabledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indices compuestos para busquedas eficientes
NicheSchema.index({ module: 1, section: 1, row: 1 });
NicheSchema.index({ status: 1, type: 1 });
NicheSchema.index({ currentOwner: 1, status: 1 });

// Verificar disponibilidad
NicheSchema.virtual('isAvailable').get(function () {
    return this.status === 'available';
});

// Marcar como vendido
NicheSchema.methods.markAsSold = async function (customerId) {
    this.status = 'sold';
    this.currentOwner = customerId;
    return await this.save();
};

// Marcar como reservado
NicheSchema.methods.markAsReserved = async function () {
    this.status = 'reserved';
    return await this.save();
};

// Liberar (volver disponible)
NicheSchema.methods.release = async function () {
    this.status = 'available';
    this.currentOwner = undefined;
    return await this.save();
};

// Transferir titularidad (sucesión/transferencia)
NicheSchema.methods.transferOwnership = async function (newOwnerId, reason, notes, registeredBy, options) {
    // Cerrar el registro actual en el historial
    if (this.currentOwner) {
        const currentEntry = this.ownershipHistory.find(
            h => h.owner.toString() === this.currentOwner.toString() && !h.endDate
        );
        if (currentEntry) {
            currentEntry.endDate = new Date();
        }
    }

    // Agregar nuevo registro al historial
    this.ownershipHistory.push({
        owner: newOwnerId,
        startDate: new Date(),
        reason: reason || 'transfer',
        notes: notes || '',
        registeredBy: registeredBy || undefined
    });

    // Actualizar propietario actual
    this.currentOwner = newOwnerId;

    return await this.save(options || {});
};

// Convertir Decimal128 -> Number en JSON e incluir virtuals
NicheSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        if (ret.price != null) ret.price = toNumber(ret.price);
        return ret;
    }
});

module.exports = mongoose.model('Niche', NicheSchema);
