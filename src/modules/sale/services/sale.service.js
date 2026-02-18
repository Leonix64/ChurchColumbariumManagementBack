/**
 * Servicio de Ventas
 * Lógica de negocio para creación y cancelación de ventas
 */

const mongoose = require('mongoose');
const Sale = require('../models/sale.model');
const Niche = require('../../niche/models/niche.model');
const Payment = require('../models/payment.model');
const Customer = require('../../customer/models/customer.model');
const Beneficiary = require('../../beneficiary/models/beneficiary.model');
const Refund = require('../models/refund.model');
const amortizationService = require('./amortization.service');
const { generateSaleFolio, generateReceiptNumber, generateBulkSaleFolio, generateRefundNumber } = require('../../../utils/folio-generator');
const { createAuditLog } = require('../../../utils/audit-logger');
const { errors } = require('../../../middlewares/errorHandler');

const saleService = {
    /**
     * Crear venta individual
     */
    async createSale({ nicheId, customerId, totalAmount, downPayment, user, req }) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const customer = await Customer.findById(customerId).session(session);
            if (!customer || customer.status !== 'active') {
                throw errors.notFound('Cliente no encontrado o inactivo');
            }

            const niche = await Niche.findById(nicheId).session(session);
            if (!niche) throw errors.notFound('Nicho');
            if (niche.status !== 'available') {
                throw errors.badRequest(`El nicho no está disponible (estado: ${niche.status})`);
            }

            // Validar que el cliente tenga al menos 3 beneficiarios (embebidos o independientes)
            const existingBeneficiaries = await Beneficiary.countDocuments({ niche: nicheId, isActive: true }).session(session);
            const embeddedCount = (customer.beneficiaries || []).length;
            if (existingBeneficiaries === 0 && embeddedCount < 3) {
                throw errors.badRequest('Se requieren al menos 3 beneficiarios para completar la venta');
            }

            const balance = totalAmount - downPayment;
            const months = 18;
            const amortizationTable = amortizationService.generateTable(balance, months);

            const newSale = new Sale({
                niche: nicheId,
                customer: customerId,
                originalCustomer: customerId,
                currentCustomer: customerId,
                user: user?.id,
                folio: generateSaleFolio(),
                totalAmount,
                downPayment,
                balance,
                totalPaid: downPayment,
                monthsToPay: months,
                amortizationTable,
                status: 'active'
            });

            await newSale.save({ session });

            // Dual-write: crear beneficiarios en colección independiente
            if (customer.beneficiaries && customer.beneficiaries.length > 0) {
                const beneficiaryDocs = customer.beneficiaries.map(b => ({
                    name: b.name,
                    relationship: b.relationship,
                    phone: b.phone,
                    email: b.email,
                    dateOfBirth: b.dateOfBirth,
                    niche: nicheId,
                    designatedBy: customerId,
                    order: b.order,
                    isActive: !b.isDeceased,
                    isDeceased: b.isDeceased || false,
                    deceasedDate: b.deceasedDate,
                    notes: b.notes
                }));
                await Beneficiary.insertMany(beneficiaryDocs, { session });
            }

            const initialPayment = new Payment({
                sale: newSale._id,
                customer: customerId,
                registeredBy: user?.id,
                receiptNumber: generateReceiptNumber(),
                amount: downPayment,
                concept: 'down_payment',
                method: 'cash',
                paymentDate: new Date(),
                appliedTo: [{
                    paymentNumber: 0,
                    appliedAmount: downPayment,
                    remainingBefore: totalAmount,
                    remainingAfter: balance
                }],
                balanceBefore: totalAmount,
                balanceAfter: balance
            });

            await initialPayment.save({ session });

            niche.status = 'sold';
            niche.currentOwner = customerId;
            await niche.save({ session });

            await createAuditLog({
                user,
                action: 'create_sale',
                module: 'sale',
                resourceType: 'Sale',
                resourceId: newSale._id,
                details: { saleId: newSale._id, folio: newSale.folio, customerId, nicheId, totalAmount, downPayment },
                req,
                session
            });

            await session.commitTransaction();
            session.endSession();

            return { sale: newSale, payment: initialPayment, niche };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    /**
     * Crear venta múltiple (bulk)
     */
    async createBulkSale({ nicheIds, customerId, totalAmount, downPayment, user, req }) {
        if (!nicheIds || !Array.isArray(nicheIds) || nicheIds.length === 0) {
            throw errors.badRequest('Selecciona al menos 1 nicho');
        }
        if (nicheIds.length > 100) {
            throw errors.badRequest('Maximo 100 nichos por venta');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const customer = await Customer.findById(customerId).session(session);
            if (!customer || customer.status !== 'active') {
                throw errors.notFound('Cliente no encontrado o inactivo');
            }

            const niches = await Niche.find({ _id: { $in: nicheIds } }).session(session);
            if (niches.length !== nicheIds.length) {
                throw errors.notFound('Algunos nichos no existen');
            }

            const unavailable = niches.filter(n => n.status !== 'available');
            if (unavailable.length > 0) {
                throw errors.badRequest(`Nichos no disponibles: ${unavailable.map(n => n.code).join(', ')}`);
            }

            const balance = totalAmount - downPayment;
            const months = 18;
            const amortizationTable = amortizationService.generateTable(balance, months);

            const newSale = new Sale({
                niche: nicheIds[0],
                customer: customerId,
                originalCustomer: customerId,
                currentCustomer: customerId,
                user: user?.id,
                folio: generateBulkSaleFolio(),
                totalAmount,
                downPayment,
                balance,
                totalPaid: downPayment,
                monthsToPay: months,
                amortizationTable,
                status: 'active',
                notes: `Venta multiple: ${nicheIds.length} nichos (${niches.map(n => n.code).join(', ')})`
            });

            await newSale.save({ session });

            const initialPayment = new Payment({
                sale: newSale._id,
                customer: customerId,
                registeredBy: user?.id,
                receiptNumber: generateReceiptNumber(),
                amount: downPayment,
                concept: 'down_payment',
                method: 'cash',
                paymentDate: new Date(),
                appliedTo: [{ paymentNumber: 0, appliedAmount: downPayment, remainingBefore: totalAmount, remainingAfter: balance }],
                balanceBefore: totalAmount,
                balanceAfter: balance
            });

            await initialPayment.save({ session });

            // Dual-write beneficiarios para cada nicho
            if (customer.beneficiaries && customer.beneficiaries.length > 0) {
                const allBeneficiaryDocs = [];
                for (const nId of nicheIds) {
                    customer.beneficiaries.forEach(b => {
                        allBeneficiaryDocs.push({
                            name: b.name, relationship: b.relationship, phone: b.phone, email: b.email,
                            dateOfBirth: b.dateOfBirth, niche: nId, designatedBy: customerId, order: b.order,
                            isActive: !b.isDeceased, isDeceased: b.isDeceased || false,
                            deceasedDate: b.deceasedDate, notes: b.notes
                        });
                    });
                }
                await Beneficiary.insertMany(allBeneficiaryDocs, { session });
            }

            await Niche.updateMany(
                { _id: { $in: nicheIds } },
                { $set: { status: 'sold', currentOwner: customerId, notes: `Venta: ${newSale.folio}` } },
                { session }
            );

            await createAuditLog({
                user,
                action: 'create_bulk_sale',
                module: 'sale',
                resourceType: 'Sale',
                resourceId: newSale._id,
                details: { saleId: newSale._id, folio: newSale.folio, customerId, nicheIds, totalNiches: nicheIds.length, totalAmount, downPayment },
                req,
                session
            });

            await session.commitTransaction();
            session.endSession();

            return { sale: newSale, payment: initialPayment, niches };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    },

    /**
     * Cancelar venta
     */
    async cancelSale({ saleId, reason, refundAmount, refundMethod, refundNotes, user, req }) {
        const refundAmountValue = Number(refundAmount) || 0;

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const sale = await Sale.findById(saleId).session(session);
            if (!sale) throw errors.notFound('Venta');
            if (sale.status === 'cancelled') throw errors.badRequest('La venta ya esta cancelada');

            if (refundAmountValue > sale.totalPaid) {
                throw errors.badRequest(`El reembolso ($${refundAmountValue}) no puede exceder el total pagado ($${sale.totalPaid})`);
            }

            const niche = await Niche.findById(sale.niche).session(session);
            if (!niche) throw errors.notFound('Nicho');

            sale.cancel(user?.id, reason.trim(), refundAmountValue, refundMethod || 'cash', refundNotes?.trim() || '');
            await sale.save({ session });

            niche.status = 'available';
            niche.currentOwner = undefined;
            niche.notes = `Venta cancelada: ${sale.folio}. Razon: ${reason.trim()}`;
            await niche.save({ session });

            let refund = null;
            if (refundAmountValue > 0) {
                refund = new Refund({
                    sale: sale._id,
                    customer: sale.customer,
                    refundedBy: user?.id,
                    receiptNumber: generateRefundNumber(),
                    amount: refundAmountValue,
                    method: refundMethod || 'cash',
                    reason: reason.trim(),
                    notes: refundNotes?.trim() || '',
                    refundDate: new Date(),
                    status: 'completed'
                });
                await refund.save({ session });
            }

            await createAuditLog({
                user,
                action: 'cancel_sale',
                module: 'sale',
                resourceType: 'Sale',
                resourceId: sale._id,
                details: {
                    saleId: sale._id, folio: sale.folio, nicheId: niche._id, nicheCode: niche.code,
                    reason: reason.trim(), refundAmount: refundAmountValue,
                    refundMethod: refundMethod || 'N/A', previousStatus: 'active', newStatus: 'cancelled'
                },
                req,
                session
            });

            await session.commitTransaction();
            session.endSession();

            return { sale, niche, refund };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
};

module.exports = saleService;
