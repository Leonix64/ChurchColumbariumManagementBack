const Sale = require('../models/sale.model');
const Niche = require('../models/niche.model');
const Payment = require('../models/payment.model');
const mongoose = require('mongoose');

const saleController = {
    /**
     * POST /api/sales
     * Crea una nueva venta con transaccion atomica
     * Pasos:
     * 1. Validar nicho disponible
     * 2. Calcular total de amortizacion
     * 3. Crear venta
     * 4. Registrar enganche
     * 5. Actualizar nicho a "vendido"
     */
    createSale: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { nicheId, customerId, totalAmount, downPayment } = req.body;

            // VALIDACIONES CRITICAS
            if (!nicheId || !customerId || !totalAmount || !downPayment) {
                throw new Error('Faltan campos requeridos');
            }

            if (downPayment <= 0) {
                throw new Error('El enganche debe ser mayor a 0');
            }

            if (downPayment >= totalAmount) {
                throw new Error('El enganche debe ser menor al total');
            }

            if (totalAmount <= 0) {
                throw new Error('El monto total debe ser mayor a 0');
            }

            // Validar que exista el cliente
            const customer = await Customer.findById(customerId).session(session);
            if (!customer) {
                throw new Error('Cliente no encontrado');
            }

            // 1. VALIDAR NICHO
            const niche = await Niche.findById(nicheId).session(session);
            if (!niche || niche.status !== 'available') {
                throw new Error('El nicho no está disponible o no existe.');
            }

            // 2. CALCULOS FINANCIEROS
            const balance = totalAmount - downPayment;
            const months = 18;
            const monthlyPaymentAmount = Number((balance / months).toFixed(2));

            // 3. GENERAR TABLA DE AMORTIZACION (18 pagos mensuales)
            let amortizationTable = [];
            let currentDate = new Date();

            for (let i = 1; i <= months; i++) {
                let paymentDate = new Date(currentDate);
                paymentDate.setMonth(paymentDate.getMonth() + i);

                amortizationTable.push({
                    number: i,
                    dueDate: paymentDate,
                    amount: monthlyPaymentAmount,
                    status: 'pending'
                });
            }

            // 4. CREAR REGISTRO DE VENTA
            const newSale = new Sale({
                niche: nicheId,
                customer: customerId,
                folio: `VENTA-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                totalAmount,
                downPayment,
                balance,
                monthsToPay: months,
                amortizationTable
            });

            await newSale.save({ session });

            // 5. REGISTRAR PAGO INICIAL (ENGANCHE)
            const initialPayment = new Payment({
                sale: newSale._id,
                customer: customerId,
                receiptNumber: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                amount: downPayment,
                concept: 'down_payment',
                method: 'cash'
            });

            await initialPayment.save({ session });

            // 6. ACTUALIZAR NICHOS (MARCAR COMO VENDIDO)
            niche.status = 'sold';
            niche.currentOwner = customerId;
            await niche.save({ session });

            // 7. CONFIRMAR TRANSACCION (TODO O NADA)
            await session.commitTransaction();
            session.endSession();

            // 8. RESPONDER CON EXITO
            res.status(201).json({
                success: true,
                message: 'Venta registrada exitosamente',
                data: {
                    sale: newSale,
                    payment: initialPayment,
                    niche: niche
                }
            });
        } catch (error) {
            // ROLLBACK: Si algo falla, se deshace todo
            await session.abortTransaction();
            session.endSession();

            res.status(400).json({
                success: false,
                message: `Error en la venta: ${error.message}`
            });
        }
    }
};

module.exports = saleController;
