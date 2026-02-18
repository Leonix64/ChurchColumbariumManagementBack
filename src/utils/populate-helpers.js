/**
 * Cadenas de populate reutilizables
 * Centraliza los patrones de populate repetidos en controllers
 */

const CUSTOMER_BASIC = { path: 'customer', select: 'firstName lastName phone email' };
const CUSTOMER_FULL = { path: 'customer', select: 'firstName lastName phone email address rfc' };
const NICHE_BASIC = { path: 'niche', select: 'code displayNumber module section type price' };
const NICHE_LIST = { path: 'niche', select: 'code displayNumber module section type' };
const USER_BASIC = { path: 'user', select: 'username fullName' };
const REGISTERED_BY = { path: 'registeredBy', select: 'username fullName' };
const CURRENT_OWNER = { path: 'currentOwner', select: 'firstName lastName phone email' };

const SALE_DETAIL_POPULATES = [
    { path: 'customer', select: 'firstName lastName phone email address' },
    { path: 'niche', select: 'code displayNumber module section type price' },
    { path: 'user', select: 'username fullName' },
    {
        path: 'amortizationTable.payments.paymentId',
        model: 'Payment',
        select: 'receiptNumber amount method notes paymentDate'
    }
];

const OWNERSHIP_HISTORY_POPULATES = [
    { path: 'ownershipHistory.owner', select: 'firstName lastName phone email' },
    { path: 'ownershipHistory.registeredBy', select: 'username fullName' }
];

module.exports = {
    CUSTOMER_BASIC,
    CUSTOMER_FULL,
    NICHE_BASIC,
    NICHE_LIST,
    USER_BASIC,
    REGISTERED_BY,
    CURRENT_OWNER,
    SALE_DETAIL_POPULATES,
    OWNERSHIP_HISTORY_POPULATES
};
