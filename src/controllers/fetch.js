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
    const issuerExist = await User.findOne({ email });

    if (!issuerExist) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgUserNotFound });
    }

    if(queryCode || queryParams){
    var inputQuery = parseInt(queryCode || queryParams);
    switch (inputQuery) {
      case 1:  
          var queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 1 }, expirationDate: { $gt: formattedDate }}]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
        break;
      case 2:
          var queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 2 }, expirationDate: { $gt: formattedDate }}]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
        break;
      case 3:
          var queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 3 }, expirationDate: { $gt: formattedDate }}]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
        break;
      case 4:
          var queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 4 }, expirationDate: { $gt: formattedDate }}]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
        break;
      case 5:
          var queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ expirationDate: { $lt: formattedDate }}]
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
      case 7:
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
            $and: [{ certificateStatus: { $eq: 3 }}]
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

    var totalResponses = queryResponse.length;
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

module.exports = {
  // Function to get all issuers (users)
  getAllIssuers,

  // Function to fetch issuer details
  getIssuerByEmail,

  // Function to Upload Files to AWS-S3 bucket
  uploadFileToS3,

  // Function to fetch details from Issuers log
  fetchIssuesLogDetails,

};
