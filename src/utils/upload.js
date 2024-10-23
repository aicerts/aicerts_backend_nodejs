// Load environment variables from .env file
require('dotenv').config();
const AWS = require('../config/aws-config');
const fs = require("fs");

// Import MongoDB models
const { User } = require("../config/schema");

const {
  fallbackProvider
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const defaultFee = process.env.DEFAULT_FEE || 0.003433189359869808;

const fetchOrEstimateTransactionFee = async (tx) => {
  if (!tx) {
    return null;
  }
try {
    const feeData = await fallbackProvider.getFeeData();
    const estimateGasPrice = BigInt(feeData.gasPrice.toString());
    const gasLimit = BigInt(tx.gasLimit.toString());
    // console.log('The assessed limit & price', gasLimit, estimateGasPrice);
    let estimatedTxFee = gasLimit * estimateGasPrice; // Fee in wei
    let calculatedTxFee = Number(estimatedTxFee) / 1e18;
    console.log("Estimated transaction fee", calculatedTxFee);
    return calculatedTxFee;
  } catch (error) {
    console.error("Failed to estimate transaction fee", error);
    return defaultFee;
    // return null;
  }
}

const updateTransactionFeeWithIssuer = async (email, txFee) => {
  if (!email || !txFee) {
    return null;
  }
  const issuerToFeeUpdate = await User.find({ email: email });
  var updatedFee;
  try {
    if (issuerToFeeUpdate.transactionFee) {
      updatedFee = issuerToFeeUpdate.transactionFee;
      issuerToFeeUpdate.transactionFee = updatedFee + txFee;
    } else {
      issuerToFeeUpdate.transactionFee = txFee;
    }
    await issuerToFeeUpdate.save(); // Save the changes to the existing issuer
    return true;
  } catch (error) {
    console.error("An error occurred", error);
    return null;
  }
};

const uploadImageToS3 = async (certNumber, imagePath) => {

  const bucketName = process.env.BUCKET_NAME;
  const keyName = `${certNumber}.png`;
  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(imagePath);
  const acl = process.env.ACL_NAME;

  let uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ACL: acl
  };

  try {
    const urlData = await s3.upload(uploadParams).promise();
    return urlData.Location;
  } catch (error) {
    console.error("Internal server error", error);
    return false;
  }
};

const _uploadImageToS3 = async (certNumber, imagePath) => {

  const bucketName = process.env.BUCKET_NAME;
  const _keyName = `${certNumber}.png`;
  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(imagePath);
  const acl = process.env.ACL_NAME;
  const keyPrefix = 'dynamic_bulk_issues/';

  const keyName = keyPrefix + _keyName;

  let uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ACL: acl
  };

  try {
    const urlData = await s3.upload(uploadParams).promise();
    return urlData.Location;
  } catch (error) {
    console.error("Internal server error", error);
    return false;
  }
};

module.exports = {

  fetchOrEstimateTransactionFee,
  // Upload media file into the S3 bucket (for the single issue)
  uploadImageToS3,
  // Upload media file into the S3 bucket (for the dynamic bulk issue)
  _uploadImageToS3,
  // Update Transaction fee with respect to issuer
  updateTransactionFeeWithIssuer
};
