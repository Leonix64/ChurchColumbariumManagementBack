const mongoose = require('mongoose');

require('./customer.model');
require('./deceased.model');
require('./niche.model');
require('./sale.model');
require('./payment.model');

console.log('■ Todos los modelos han sido registrados');

module.exports = mongoose;