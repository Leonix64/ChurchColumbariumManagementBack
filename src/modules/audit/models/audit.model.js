const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema({
    // QUIEN hizo la acción?
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

    // QUE hizo?
    action: {
        type: String,
        required: true,
        enum: [
            // Auth
            'login', 'logout', 'register', 'change_password',
            // Clientes
            'create_customer', 'update_customer', 'delete_customer',
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

    // EN QUE módulo?
    module: {
        type: String,
        enum: ['auth', 'customer', 'niche', 'sale', 'payment'],
        required: true
    },

    // A QUE recurso afectó?
    resourceType: String,
    resourceId: mongoose.Schema.Types.ObjectId,

    // DETALLES completos
    details: Object,

    // CUANDO?
    timestamp: {
        type: Date,
        default: Date.now
    },

    // INFO de la request
    ip: String,
    userAgent: String,

    // Fue exitoso?
    status: {
        type: String,
        enum: ['success', 'error', 'warning'],
        default: 'success'
    },
    errorMessage: String
}, {
    timestamps: false
});

// Auto-eliminar logs despues de 1 año (opcional)
AuditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('Audit', AuditSchema);
