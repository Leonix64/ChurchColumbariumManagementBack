const mongoose = require('mongoose');

/**
 * AUDITORÍA
 * Registro de todas las acciones realizadas en el sistema.
 * Rastrea quién hizo qué, cuándo y en qué módulo.
 * Los logs se auto-eliminan después de 1 año.
 */
const AuditSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    username: String,

    userRole: {
        type: String,
        enum: ['admin', 'seller', 'viewer']
    },

    action: {
        type: String,
        required: true,
        enum: [
            // Auth
            'login', 'logout', 'register', 'change_password',
            // Clientes
            'create_customer', 'update_customer', 'delete_customer',
            // Beneficiarios
            'create_beneficiary', 'update_beneficiary', 'bulk_update_beneficiaries',
            'update_beneficiaries', 'mark_beneficiary_deceased',
            // Nichos
            'create_niche', 'update_niche', 'disable_niche', 'enable_niche',
            'change_material', 'bulk_change_material', 'change_price',
            // Ventas
            'create_sale', 'register_payment', 'create_bulk_sale', 'cancel_sale',
            // Mantenimiento
            'register_maintenance',
            // Sucesión
            'register_succession', 'manual_transfer'
        ]
    },

    module: {
        type: String,
        enum: ['auth', 'customer', 'niche', 'sale', 'payment', 'succession', 'maintenance'],
        required: true
    },

    resourceType: String,
    resourceId: mongoose.Schema.Types.ObjectId,

    details: Object,

    timestamp: {
        type: Date,
        default: Date.now
    },

    ip: String,
    userAgent: String,

    status: {
        type: String,
        enum: ['success', 'error', 'warning'],
        default: 'success'
    },

    errorMessage: String
}, {
    timestamps: { createdAt: true, updatedAt: true }
});

// TTL: auto-eliminar registros después de 1 año (365 días)
AuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('Audit', AuditSchema);
