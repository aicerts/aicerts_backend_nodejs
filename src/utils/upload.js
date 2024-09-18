// Load environment variables from .env file
require('dotenv').config();
const AWS = require('../config/aws-config');
const fs = require("fs");

const {
  fallbackProvider
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const fetchOrEstimateTransactionFee = async (tx, timeoutDuration = 5500) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Transaction timed out')), timeoutDuration)
  );
  if (!tx) {
    return null;
  }
  try {
    const receipt = await Promise.race([tx.wait(), timeoutPromise]);

    // If the receipt is obtained, calculate the transaction fee
    if (receipt) {
      const gasUsed = BigInt(receipt.gasUsed.toString());
      const gasPrice = BigInt(receipt.gasPrice.toString());
      // console.log('The actual gas fee', gasUsed, gasPrice);
      
      let txFee = gasUsed * gasPrice; // Fee in wei
      let actualTxFee = Number(txFee) / 1e18;
      console.log("Actual transaction fee", actualTxFee);
      return actualTxFee;
    }
  } catch (error) {
    // If the error is a timeout, proceed to estimation
    if (error.message === 'Transaction timed out') {
      console.warn('Transaction timed out, proceeding to estimate transaction fee.');
    } else {
      console.error("An error occurred", error);
      return null;
    }
  }

  // If we reach here, it means either a timeout occurred or no receipt was obtained
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
    return null;
  }
}

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
  _uploadImageToS3
};
