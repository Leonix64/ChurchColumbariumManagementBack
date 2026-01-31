const mongoose = require('mongoose');

require('./customer.model');
require('./deceased.model');
require('./niche.model');
require('./sale.model');
require('./payment.model');
require('./refund.model');

console.log('[INFO] Modelos registrados correctamente');

module.exports = mongoose;
