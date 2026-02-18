const Niche = require('../../niche/models/niche.model');
const Customer = require('../../customer/models/customer.model');
const Payment = require('../../sale/models/payment.model');
const Beneficiary = require('../../beneficiary/models/beneficiary.model');
const Deceased = require('../../niche/models/deceased.model');
const { asyncHandler, errors } = require('../../../middlewares/errorHandler');
const { generateMaintenanceReceipt } = require('../../../utils/folio-generator');
const { createAuditLog } = require('../../../utils/audit-logger');

const maintenanceController = {
    /**
     * REGISTRAR PAGO DE MANTENIMIENTO
     * POST /api/niches/:id/maintenance
     */
    registerMaintenance: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { year, amount, method, notes } = req.body;

        // Validaciones básicas
        if (!year || !amount || !method) {
            throw errors.badRequest('Año, monto y método de pago son requeridos');
        }

        if (amount <= 0) {
            throw errors.badRequest('El monto debe ser mayor a 0');
        }

        // Validar que el año sea válido
        const currentYear = new Date().getFullYear();
        if (year > currentYear + 1) {
            throw errors.badRequest(`El año no puede ser mayor a ${currentYear + 1}`);
        }

        // Buscar nicho
        const niche = await Niche.findById(id).populate('currentOwner', 'firstName lastName phone email');

        if (!niche) {
            throw errors.notFound('Nicho');
        }

        // Verificar que el nicho esté vendido
        if (niche.status !== 'sold') {
            throw errors.badRequest('Solo se puede registrar mantenimiento para nichos vendidos');
        }

        // Verificar que tenga propietario
        if (!niche.currentOwner) {
            throw errors.badRequest('El nicho no tiene propietario registrado');
        }

        const owner = niche.currentOwner;

        // Verificar si ya existe un pago de mantenimiento para este nicho en este año
        const existingPayment = await Payment.findOne({
            niche: id,
            concept: 'maintenance',
            maintenanceYear: year
        });

        if (existingPayment) {
            throw errors.conflict(`Ya existe un pago de mantenimiento registrado para este nicho en el año ${year}`);
        }

        // Crear pago de mantenimiento
        const maintenancePayment = await Payment.create({
            niche: id,
            customer: owner._id, // Propietario ACTUAL al momento del pago
            sale: null,
            registeredBy: req.user?.id,
            receiptNumber: generateMaintenanceReceipt(),
            amount,
            concept: 'maintenance',
            method,
            maintenanceYear: year,
            paymentDate: new Date(),
            notes: notes || `Mantenimiento anual - Nicho ${niche.code}`,
            balanceBefore: 0,
            balanceAfter: 0
        });

        // Registrar auditoría
        await createAuditLog({
            user: req.user,
            action: 'register_maintenance',
            module: 'payment',
            resourceType: 'Payment',
            resourceId: maintenancePayment._id,
            details: {
                nicheId: id,
                nicheCode: niche.code,
                customerId: owner._id,
                customerName: `${owner.firstName} ${owner.lastName}`,
                paymentId: maintenancePayment._id,
                receiptNumber: maintenancePayment.receiptNumber,
                amount,
                method,
                year,
                concept: 'maintenance'
            },
            req
        });

        res.status(201).json({
            success: true,
            message: `Pago de mantenimiento registrado para el nicho ${niche.code} (año ${year})`,
            data: {
                payment: maintenancePayment,
                niche: {
                    code: niche.code,
                    displayNumber: niche.displayNumber,
                    module: niche.module,
                    section: niche.section
                },
                owner: {
                    name: `${owner.firstName} ${owner.lastName}`,
                    phone: owner.phone,
                    email: owner.email
                }
            }
        });
    }),

    /**
     * OBTENER PAGOS DE MANTENIMIENTO DE UN NICHO
     * GET /api/niches/:id/maintenance
     */
    getMaintenancePayments: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const niche = await Niche.findById(id);
        if (!niche) {
            throw errors.notFound('Nicho');
        }

        // Buscar todos los pagos de mantenimiento del nicho
        const maintenancePayments = await Payment.find({
            niche: id,
            concept: 'maintenance'
        })
            .populate('customer', 'firstName lastName phone email')
            .populate('registeredBy', 'username fullName')
            .sort({ maintenanceYear: -1, paymentDate: -1 });

        res.status(200).json({
            success: true,
            count: maintenancePayments.length,
            niche: {
                code: niche.code,
                displayNumber: niche.displayNumber,
                module: niche.module
            },
            data: maintenancePayments
        });
    }),

    /**
     * OBTENER HISTORIAL DE MANTENIMIENTO POR CLIENTE
     * GET /api/customers/:id/maintenance-history
     * (Útil para ver qué mantenimientos pagó un cliente, aunque el nicho ya no sea suyo)
     */
    getCustomerMaintenanceHistory: asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await Customer.findById(id);
        if (!customer) {
            throw errors.notFound('Cliente');
        }

        // Buscar pagos de mantenimiento donde este cliente fue el que pagó
        const maintenancePayments = await Payment.find({
            customer: id,
            concept: 'maintenance'
        })
            .populate('niche', 'code displayNumber module section currentOwner')
            .populate('registeredBy', 'username fullName')
            .sort({ paymentDate: -1 });

        res.status(200).json({
            success: true,
            count: maintenancePayments.length,
            customer: {
                name: `${customer.firstName} ${customer.lastName}`,
                phone: customer.phone
            },
            data: maintenancePayments
        });
    })
    ,

    /**
     * BACKFILL: Migrar datos existentes al nuevo modelo
     * POST /api/maintenance/backfill
     * Solo admin. Ejecutar una sola vez después de actualizar el esquema.
     */
    backfillData: asyncHandler(async (req, res) => {
        const results = {
            customersUpdated: 0,
            deceasedCustomers: 0,
            inactiveCustomers: 0,
            activeCustomers: 0,
            beneficiariesLinked: 0,
            nichesOccupantsFixed: 0
        };

        // 1. Actualizar Customer.status basado en active y Deceased
        const allCustomers = await Customer.find({});
        for (const customer of allCustomers) {
            // Si ya tiene status, saltar
            if (customer.status && customer.status !== 'active') {
                continue;
            }

            // Si active es false (campo legacy en documentos existentes), determinar si es deceased o inactive
            const isActive = customer.get('active');
            if (isActive === false || customer.status === 'inactive') {
                const deceasedRecord = await Deceased.findOne({ wasCustomer: customer._id });
                if (deceasedRecord) {
                    customer.status = 'deceased';
                    customer.deceasedDate = deceasedRecord.dateOfDeath;
                    customer.deceasedRecordId = deceasedRecord._id;
                    results.deceasedCustomers++;
                } else {
                    customer.status = 'inactive';
                    results.inactiveCustomers++;
                }
                await customer.save({ validateBeforeSave: false });
                results.customersUpdated++;
            } else if (!customer.status) {
                customer.status = 'active';
                await customer.save({ validateBeforeSave: false });
                results.activeCustomers++;
                results.customersUpdated++;
            }
        }

        // 2. Vincular Beneficiaries con Customer existentes (por teléfono)
        const unlinkedBeneficiaries = await Beneficiary.find({ linkedCustomer: null, isActive: false, becameOwnerAt: { $ne: null } });
        for (const ben of unlinkedBeneficiaries) {
            if (ben.phone) {
                const matchingCustomer = await Customer.findOne({ phone: ben.phone });
                if (matchingCustomer) {
                    ben.linkedCustomer = matchingCustomer._id;
                    if (!ben.inactivationReason) {
                        ben.inactivationReason = 'inherited';
                    }
                    await ben.save();
                    results.beneficiariesLinked++;
                }
            }
        }

        // 3. Popular niche.occupants desde Deceased
        const nichesWithDeceased = await Deceased.find({ niche: { $ne: null } });
        for (const deceased of nichesWithDeceased) {
            const niche = await Niche.findById(deceased.niche);
            if (niche && !niche.occupants.includes(deceased._id)) {
                niche.occupants.push(deceased._id);
                await niche.save();
                results.nichesOccupantsFixed++;
            }
        }

        res.status(200).json({
            success: true,
            message: 'Backfill completado',
            data: results
        });
    })
};

module.exports = maintenanceController;
