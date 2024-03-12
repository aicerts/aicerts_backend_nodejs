// aws-config.js

const AWS = require('aws-sdk');
require('dotenv').config();
// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION
});

module.exports = AWS;

