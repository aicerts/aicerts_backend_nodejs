// utils.js
const utils = {};

utils.password = encodeURIComponent('Sonometer$99');
utils.MONGODB_URI = `mongodb+srv://andyparimi:${utils.password}@democluster.dqevzap.mongodb.net/Users?retryWrites=true&w=majority`;

module.exports = utils;