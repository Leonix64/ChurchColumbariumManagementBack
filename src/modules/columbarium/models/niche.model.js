const mongoose = require('mongoose');

/**
 * Modelo de NICHO
 * Representa cada espeacio del columbario
 * Cada nicho tiene un codigo unico y propiedades especificas
 */

const NicheSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true, index: true },

    // El numero pintado en la pared (Ej: 52)
    displayNumber: { type: Number, required: true },


    // Ubicacion fisica
    module: { type: String, required: true }, // A, B, C...
    section: { type: String, required: true }, // A, B...
    row: { type: Number, required: true }, // Fila 1
    number: { type: Number, required: true }, // Columna 1 a 51

    // Caracteristicas
    type: {
        type: String,
        enum: ['wood', 'marble', 'special'],
        default: 'wood'
    },
    price: { type: Number, required: true },// Precio en pesos

    // Estado actual
    status: {
        type: String,
        enum: ['available', 'reserved', 'sold'],
        default: 'available'
    },
    // Referencia al dueño actual (si esta vendido)
    currentOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    // Array de ocupantes (puede ser mas de una urna en el futuro)
    occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Deceased' }],

    // informacion adicional
    notes: { type: String },
}, { timestamps: true }); // Crea createdAt y updatedAt automaticamente

module.exports = mongoose.model('Niche', NicheSchema);
