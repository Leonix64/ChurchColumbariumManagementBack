const mongoose = require('mongoose');

require('./beneficiary.model');
require('./customer.model');
require('./deceased.model');
require('./niche.model');
require('./sale.model');
require('./payment.model');
require('./refund.model');
require('./amortSchedule.model');
require('./paymentScheduleLink.model');
require('./succession.model');

console.log('[INFO] Modelos registrados correctamente');

module.exports = mongoose;
