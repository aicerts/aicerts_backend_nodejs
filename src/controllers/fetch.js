// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
const fs = require("fs");
const AWS = require('../config/aws-config');
const { validationResult } = require("express-validator");
const moment = require('moment');

// Import MongoDB models
const { User, Issues, BatchIssues, IssueStatus } = require("../config/schema");

// Importing functions from a custom module
const {
  isDBConnected // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

var messageCode = require("../common/codes");
app.use("../../uploads", express.static(path.join(__dirname, "uploads")));

/**
 * API to fetch all issuer details who are unapproved.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getAllIssuers = async (req, res) => {
  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);

    // Fetch all users from the database
    const allIssuers = await User.find({ approved: false }).select('-password');

    // Respond with success and all user details
    res.json({
      status: 'SUCCESS',
      data: allIssuers,
      message: messageCode.msgAllIssuersFetched
    });
  } catch (error) {
    // Error occurred while fetching user details, respond with failure message
    res.json({
      status: 'FAILED',
      message: messageCode.msgErrorOnFetching
    });
  }
};

/**
 * API to fetch details of Issuer.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getIssuerByEmail = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    const { email } = req.body;

    const issuer = await User.findOne({ email: email }).select('-password');

    if (issuer) {
      res.json({
        status: 'SUCCESS',
        data: issuer,
        message: `Issuer with email ${email} fetched successfully`
      });
    } else {
      res.json({
        status: 'FAILED',
        message: `Issuer with email ${email} not found`
      });
    }
  } catch (error) {
    res.json({
      status: 'FAILED',
      message: messageCode.msgErrorOnFetching
    });
  }
};

/**
 * API to Upload Files to AWS-S3 bucket.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const uploadFileToS3 = async (req, res) => {
  const file = req.file;
  const filePath = file.path;

  const bucketName = process.env.BUCKET_NAME;
  const keyName = file.originalname;

  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(filePath);

  const uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    console.log('File uploaded successfully to', data.Location);
    res.status(200).send({ status: "SUCCESS", message: 'File uploaded successfully', fileUrl: data.Location });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ status: "FAILED", error: 'An error occurred while uploading the file', details: error });
  }
};

/**
 * API to fetch details with Query-parameter.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const fetchIssuesLogDetails = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const queryCode = req.body.queryCode;
    const queryParams = req.query.queryParams;

    // Get today's date
    var today = new Date();
    // Formatting the parsed date into ISO 8601 format with timezone
    var formattedDate = today.toISOString();

    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);

    // Check if user with provided email exists
    const issuerExist = await User.findOne({ email: email });

    if (!issuerExist) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgUserNotFound });
    }

    if (queryCode || queryParams) {
      var inputQuery = parseInt(queryCode || queryParams);
      switch (inputQuery) {
        case 1:  // Get the all issued certs count
          // var queryResponse = await IssueStatus.find({
          //   email: req.body.email,
          //   $and: [{ certStatus: { $eq: 1 }, expirationDate: { $gt: formattedDate }}]
          // });
          // // Sort the data based on the 'lastUpdate' date in descending order
          // queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          var issueCount = issuerExist.certificatesIssued;
          var renewCount = issuerExist.certificatesRenewed;
          var revokedCount = await IssueStatus.find({
            email: req.body.email,
            certStatus: 3
          });
          var reactivatedCount = await IssueStatus.find({
            email: req.body.email,
            certStatus: 4
          });
          var queryResponse = { issued: issueCount, renewed: renewCount, revoked: revokedCount.length, reactivated: reactivatedCount.length };
          break;
        case 2:
          var __queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [
              { certStatus: { $eq: 1 } }, 
              {expirationDate: { $gt: formattedDate }}]
          });
          var _queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [
              { certStatus: { $eq: 2 } }, 
              {expirationDate: { $gt: formattedDate }}]
          });
          var queryResponse = {__queryResponse, _queryResponse};
          // Sort the data based on the 'lastUpdate' date in descending order
          // queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 3:
          var _queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 1 }, expirationDate: { $ne: "1" }}]
          });
          var __queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 1 }, expirationDate: { $ne: "1" }}]
          });
          var queryResponse = {_queryResponse, __queryResponse};
          // Sort the data based on the 'lastUpdate' date in descending order
          // queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 4:
          var queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 3 }, expirationDate: { $gt: formattedDate } }]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 5:
          var queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ expirationDate: { $lt: formattedDate } }]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 6:
          var query1Promise = Issues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2] }
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          var query2Promise = BatchIssues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2] }
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // Wait for both queries to resolve
          var [queryResponse1, queryResponse2] = await Promise.all([query1Promise, query2Promise]);

          // Merge the results into a single array
          var queryResponse = [...queryResponse1, ...queryResponse2];
          // Sort the data based on the 'issueDate' date in descending order
          queryResponse.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
          break;
        case 7://To fetch Revoked certifications and count
          var query1Promise = Issues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: 3
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          var query2Promise = BatchIssues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: 3
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // Wait for both queries to resolve
          var [queryResponse1, queryResponse2] = await Promise.all([query1Promise, query2Promise]);

          // Merge the results into a single array
          var queryResponse = [...queryResponse1, ...queryResponse2];
          // Sort the data based on the 'issueDate' date in descending order
          queryResponse.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
          break;
        case 8:
          var queryResponse = await Issues.find({
            issuerId: issuerExist.issuerId,
            $and: [{ certificateStatus: { $eq: 3 } }]
          });
          break;
        default:
          var queryResponse = 0;
          var totalResponses = 0;
          var responseMessage = messageCode.msgNoMatchFound;
      };
    } else {
      var queryResponse = 0;
      var totalResponses = 0;
      var responseMessage = messageCode.msgNoMatchFound;
    }

    var totalResponses = queryResponse.length || queryResponse > 0;
    var responseStatus = totalResponses > 0 ? 'SUCCESS' : 'FAILED';
    var responseMessage = totalResponses > 0 ? messageCode.msgAllQueryFetched : messageCode.msgNoMatchFound;

    // Respond with success and all user details
    res.json({
      status: responseStatus,
      data: queryResponse,
      responses: totalResponses,
      message: responseMessage
    });

  } catch (error) {
    // Error occurred while fetching user details, respond with failure message
    res.json({
      status: 'FAILED',
      message: messageCode.msgErrorOnFetching
    });
  }
};

const uploadCertificateToS3 = async (req, res) => {
  const file = req?.file;
  const filePath = file?.path;
  const certificateId = req?.body?.certificateId;
  const type = parseInt(req?.body?.type, 10); // Parse type to integer

  // Validate request parameters
  if (!file || !certificateId || !type) {
    return res.status(400).send({ status: "FAILED", message: "file, certificateId, and type are required" });
  }

  // Check if the certificate exists with the specified type
  let certificate;
  try {
    if (type === 1 || type === 2) {
      const typeField = type === 1 ? 'withpdf' : 'withoutpdf';
      certificate = await Issues.findOne({ _id: certificateId, type: typeField });
    } else if (type === 3) {
      certificate = await BatchIssues.findOne({ _id: certificateId });
    }

    if (!certificate) {
      return res.status(404).send({ status: "FAILED", message: "Certificate not found with the specified type" });
    }
  } catch (error) {
    console.error('Error finding certificate:', error);
    return res.status(500).send({ status: "FAILED", message: 'An error occurred while checking the certificate' });
  }

  const bucketName = process.env.BUCKET_NAME;
  const keyName = file.originalname;

  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(filePath);

  const uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    console.log('File uploaded successfully to', data.Location);
    
    // Update schemas based on the type
    switch (type) {
      case 1:
        await updateIssuesSchema(certificateId, data.Location, 'withpdf');
        break;
      case 2:
        await updateIssuesSchema(certificateId, data.Location, 'withoutpdf');
        break;
      case 3:
        await updateBatchIssuesSchema(certificateId, data.Location);
        break;
      default:
        console.error('Invalid type:', type);
        return res.status(400).send({ status: "FAILED", message: 'Invalid type' });
    }

    res.status(200).send({ status: "SUCCESS", message: 'File uploaded successfully', fileUrl: data.Location });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ status: "FAILED", message: 'An error occurred while uploading the file', details: error.message });
  }
};

// Function to update IssuesSchema for type 1 and 2
async function updateIssuesSchema(certificateId, url, type) {
  try {
    // Update IssuesSchema using certificateId
    // Example code assuming mongoose is used for MongoDB
    await Issues.findOneAndUpdate(
      { _id: certificateId },
      { $set: { url: url, type: type } }
    );
  } catch (error) {
    console.error('Error updating IssuesSchema:', error);
    throw error;
  }
}

// Function to update BatchIssuesSchema for type 3
async function updateBatchIssuesSchema(certificateId, url) {
  try {
    // Update BatchIssuesSchema using certificateId
    // Example code assuming mongoose is used for MongoDB
    await BatchIssues.findOneAndUpdate(
      { _id: certificateId },
      { $set: { url: url } }
    );
  } catch (error) {
    console.error('Error updating BatchIssuesSchema:', error);
    throw error;
  }
}


const getSingleCertificates = async (req, res) => {
  try {
    const { issuerId, type } = req.body;

    // Validate request body
    if (!issuerId || (type !== 1 && type !== 2)) {
      return res.status(400).json({ status: "FAILED", message: "issuerId and valid type (1 or 2) are required" });
    }

  // Convert type to integer if it is a string
  const typeInt = parseInt(type, 10);

  // Determine the type field value based on the provided type
  let typeField;
  if (typeInt == 1) {
    typeField = 'withpdf';
  } else if (typeInt == 2) {
    typeField = 'withoutpdf';
  } else {
    return res.status(400).json({ status: "FAILED", message: "Invalid type provided" });
  }

    // Fetch certificates based on issuerId and type
    const certificates = await Issues.find({ issuerId, type: typeField });

    // Respond with success and the certificates
    res.json({
      status: 'SUCCESS',
      data: certificates,
      message: 'Certificates fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);

    // Respond with failure message
    res.status(500).json({
      status: 'FAILED',
      message: 'An error occurred while fetching the certificates',
      details: error.message
    });
  }
};

const getBatchCertificates = async (req, res) => {
  try {
    const { issuerId } = req.body;

    // Validate issuerId
    if (!issuerId) {
      return res.status(400).json({ status: "FAILED", message: "issuerId is required" });
    }

    // Fetch all batch certificates for the given issuerId
    const batchCertificates = await BatchIssues.find({ issuerId });

    // Group certificates by issueDate
    const groupedCertificates = batchCertificates.reduce((acc, certificate) => {
      const issueDate = certificate.issueDate.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
      if (!acc[issueDate]) {
        acc[issueDate] = [];
      }
      acc[issueDate].push(certificate);
      return acc;
    }, {});

    // Transform grouped certificates into an array of objects
    const result = Object.keys(groupedCertificates).map(issueDate => ({
      issueDate,
      certificates: groupedCertificates[issueDate]
    }));

    // Respond with success and the grouped certificates
    res.json({
      status: 'SUCCESS',
      data: result,
      message: 'Batch certificates fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching batch certificates:', error);

    // Respond with failure message
    res.status(500).json({
      status: 'FAILED',
      message: 'An error occurred while fetching the batch certificates',
      details: error.message
    });
  }
};
module.exports = {
  // Function to get all issuers (users)
  getAllIssuers,

  // Function to fetch issuer details
  getIssuerByEmail,

  // Function to Upload Files to AWS-S3 bucket
  uploadFileToS3,

  // Function to fetch details from Issuers log
  fetchIssuesLogDetails,

  uploadCertificateToS3,
  getSingleCertificates,
  getBatchCertificates


};
