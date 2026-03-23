const mongoose = require('mongoose');
const logger = require('../../../utils/logger');

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

logger.info('Modelos registrados correctamente');

module.exports = mongoose;
