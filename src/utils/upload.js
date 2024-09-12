// Load environment variables from .env file
require('dotenv').config();
const AWS = require('../config/aws-config');
const fs = require("fs");


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
  // Upload media file into the S3 bucket (for the single issue)
  uploadImageToS3,
  // Upload media file into the S3 bucket (for the dynamic bulk issue)
  _uploadImageToS3
};
