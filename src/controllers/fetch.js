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
const { User, Issues, BatchIssues, IssueStatus, VerificationLog } = require("../config/schema");

// Importing functions from a custom module
const {
  isDBConnected // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

var messageCode = require("../common/codes");
app.use("../../uploads", express.static(path.join(__dirname, "uploads")));

const minimum_year_range = parseInt(process.env.BASE_YEAR);
const maximum_year_range = parseInt(process.env.BENCH_YEAR);

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
 * API to fetch details of Certification by giving name / certification ID.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getIssueDetails = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  const input = req.body.input;
  const _type = req.body.type;
  const email = req.body.email;
  var responseData;

  if (!input || !email) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidInput });
  }

  var type = parseInt(_type);
  if (type != 1 && type != 2 && type != 3) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgTypeRestricted });
  }

  try {
    var dbStatus = await isDBConnected();

    if (dbStatus == false) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgDbNotReady });
    }

    // Check if user with provided email exists
    const issuerExist = await User.findOne({ email: email });

    if (!issuerExist) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgUserNotFound });
    }

    try {
      if (type == 1) {
        // check if the input is Existed cert ID or name for Renew
        var isIssueSingle = await Issues.findOne({
          issuerId: issuerExist.issuerId,
          certificateNumber: input,
          certificateStatus: { $in: [1, 2, 4] },
          expirationDate: { $ne: "1" }
        });

        var isIssueBatch = await BatchIssues.findOne({
          issuerId: issuerExist.issuerId,
          certificateNumber: input,
          certificateStatus: { $in: [1, 2, 4] },
          expirationDate: { $ne: "1" }
        });

      } else if (type == 2) {
        // check if the input is Existed cert ID or name for reactivate
        var isIssueSingle = await Issues.findOne({
          issuerId: issuerExist.issuerId,
          certificateNumber: input,
          certificateStatus: 3
        });

        var isIssueBatch = await BatchIssues.findOne({
          issuerId: issuerExist.issuerId,
          certificateNumber: input,
          certificateStatus: 3
        });

      } else if (type == 3) {
        // check if the input is Existed cert ID or name for revoke
        var isIssueSingle = await Issues.findOne({
          issuerId: issuerExist.issuerId,
          certificateNumber: input,
          certificateStatus: { $in: [1, 2, 4] }
        });

        var isIssueBatch = await BatchIssues.findOne({
          issuerId: issuerExist.issuerId,
          certificateNumber: input,
          certificateStatus: { $in: [1, 2, 4] }
        });
      }

      if (isIssueSingle || isIssueBatch) {
        responseData = isIssueSingle != null ? isIssueSingle : isIssueBatch;
        responseData = [responseData];
        return res.status(200).json({ status: "SUCCESS", message: messageCode.msgIssueFound, data: responseData });
      }

    } catch (error) {
      return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }

    try {
      if (type == 1) {
        // check if the input is Existed cert ID or name for Renew
        var isIssueSingleName = Issues.find({
          issuerId: issuerExist.issuerId,
          name: input,
          certificateStatus: { $in: [1, 2, 4] },
          expirationDate: { $ne: "1" }
        }).lean();

        var isIssueBatchName = BatchIssues.find({
          issuerId: issuerExist.issuerId,
          name: input,
          certificateStatus: { $in: [1, 2, 4] },
          expirationDate: { $ne: "1" }
        }).lean();

      } else if (type == 2) {
        // check if the input is Existed cert ID or name for Reactivate
        var isIssueSingleName = Issues.find({
          issuerId: issuerExist.issuerId,
          name: input,
          certificateStatus: 3
        }).lean();

        var isIssueBatchName = BatchIssues.find({
          issuerId: issuerExist.issuerId,
          name: input,
          certificateStatus: 3
        }).lean();

      } else if (type == 3) {
        // check if the input is Existed cert ID or name for Revoke
        var isIssueSingleName = Issues.find({
          issuerId: issuerExist.issuerId,
          name: input,
          certificateStatus: { $in: [1, 2, 4] }
        }).lean();

        var isIssueBatchName = BatchIssues.find({
          issuerId: issuerExist.issuerId,
          name: input,
          certificateStatus: { $in: [1, 2, 4] }
        }).lean();
      }

      var [singleNameResponse, batchNameResponse] = await Promise.all([isIssueSingleName, isIssueBatchName]);

      if (singleNameResponse.length != 0 || batchNameResponse.length != 0) {
        if (singleNameResponse.length != 0 || batchNameResponse.length != 0) {
          responseData = singleNameResponse.length != 0 ? singleNameResponse : batchNameResponse;
        }
        if (singleNameResponse.length != 0 && batchNameResponse.length != 0) {
          responseData = [...singleNameResponse, ...batchNameResponse];
        }
        return res.status(200).json({ status: "SUCCESS", message: messageCode.msgIssueFound, data: responseData });
      }
    } catch (error) {
      return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }

    return res.status(400).json({ status: "FAILED", message: messageCode.msgIssueNotFound });

  } catch (error) {
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
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
 * API to fetch details of Verification results input as Course name.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getVerificationDetailsByCourse = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {

    const email = req.body.email;
    // Check mongoose connection
    const dbStatus = await isDBConnected();

    const isEmailExist = await User.findOne({ email: email });

    if (!isEmailExist) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgUserEmailNotFound });
    }

    const verificationCommonResponse = await VerificationLog.findOne({ email: email });

    if (verificationCommonResponse) {
      var responseCount = verificationCommonResponse.courses;
      res.status(200).json({
        status: 'SUCCESS',
        data: responseCount,
        message: `Verification results fetched successfully with searched course`
      });
      return;
    } else {
      res.status(400).json({
        status: 'FAILED',
        data: 0,
        message: `No verification results found`
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      status: 'FAILED',
      data: error,
      message: messageCode.msgErrorOnFetching
    });
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

    // Get today's date
    const getTodayDate = async () => {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0'); // Add leading zero if month is less than 10
      const day = String(today.getDate()).padStart(2, '0'); // Add leading zero if day is less than 10
      const year = today.getFullYear();
      return `${month}/${day}/${year}`;
    };
    const todayDate = await getTodayDate();

    // console.log("date", todayDate);

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
              { expirationDate: { $gt: formattedDate } }]
          });
          var _queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [
              { certStatus: { $eq: 2 } },
              { expirationDate: { $gt: formattedDate } }]
          });
          var queryResponse = { __queryResponse, _queryResponse };
          // Sort the data based on the 'lastUpdate' date in descending order
          // queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 3:
          var _queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 1 }, expirationDate: { $ne: "1" } }]
          });
          var __queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 2 }, expirationDate: { $ne: "1" } }]
          });
          var queryResponse = { _queryResponse, __queryResponse };
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
          var filteredResponse6 = [];
          var query1Promise = Issues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2, 4] }
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          var query2Promise = BatchIssues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2, 4] }
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // Wait for both queries to resolve
          var [queryResponse1, queryResponse2] = await Promise.all([query1Promise, query2Promise]);

          // Merge the results into a single array
          var _queryResponse = [...queryResponse1, ...queryResponse2];
          // Sort the data based on the 'issueDate' date in descending order
          _queryResponse.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

          for (var item6 of _queryResponse) {
            var certificateNumber = item6.certificateNumber;
            const issueStatus6 = await IssueStatus.findOne({ certificateNumber });
            if (issueStatus6) {
              // Push the matching issue status into filteredResponse
              filteredResponse6.push(item6);
            }
            // If filteredResponse reaches 30 matches, break out of the loop
            if (filteredResponse6.length >= 30) {
              break;
            }
          }
          // Take only the first 30 records
          // var queryResponse = _queryResponse.slice(0, Math.min(_queryResponse.length, 30));
          var queryResponse = filteredResponse6;
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
          var _queryResponse = [...queryResponse1, ...queryResponse2];
          // Sort the data based on the 'issueDate' date in descending order
          _queryResponse.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

          // Take only the first 30 records
          var queryResponse = _queryResponse.slice(0, Math.min(_queryResponse.length, 30));
          break;
        case 8:
          var filteredResponse8 = [];
          var query1Promise = Issues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2, 4] },
            expirationDate: { $ne: "1" }
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          var query2Promise = BatchIssues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2, 4] },
            expirationDate: { $ne: "1" }
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // Wait for both queries to resolve
          var [queryResponse1, queryResponse2] = await Promise.all([query1Promise, query2Promise]);

          // Merge the results into a single array
          var queryResponse = [...queryResponse1, ...queryResponse2];

          // Filter the data to show only expiration dates on or after today
          queryResponse = queryResponse.filter(item => new Date(item.expirationDate) >= new Date(todayDate));

          // Sort the data based on the 'expirationDate' date in descending order
          queryResponse.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

          for (var item8 of queryResponse) {
            var certificateNumber = item8.certificateNumber;
            const issueStatus8 = await IssueStatus.findOne({ certificateNumber });
            if (issueStatus8) {
              // Push the matching issue status into filteredResponse
              filteredResponse8.push(item8);
            }
            // If filteredResponse reaches 30 matches, break out of the loop
            if (filteredResponse8.length >= 30) {
              break;
            }
          }
          // Take only the first 30 records
          // var queryResponse = queryResponse.slice(0, Math.min(queryResponse.length, 30));
          var queryResponse = filteredResponse8;
          break;
        case 9:
          var queryResponse = await Issues.find({
            issuerId: issuerExist.issuerId,
            $and: [{ certificateStatus: { $eq: 4 } }]
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

    var totalResponses = queryResponse.length || Object.keys(queryResponse).length;
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

/**
 * API to fetch Graph details with Single & Batch issue in the Year.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const fetchGraphDetails = async (req, res) => {
  const _year = req.params.year; // Get the value from the URL parameter
  const email = req.params.email; // Get the email from the URL parameter

  var year = parseInt(_year);
  // Check if value is between 1 and 12 and equal to 2024
  if ((year !== null && year !== '') && // Check if value is not null or empty
    (year < 2000 || year > 9999)) {
    // Send the fetched graph data as a response
    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGraphInput, details: year });
  }

  // Check mongoose connection
  const dbStatus = await isDBConnected();
  const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
  console.log(dbStatusMessage);

  if (dbStatus == false) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgDbError });
  }

  // Check if user with provided email exists
  const issuerExist = await User.findOne({ email: email });

  if (!issuerExist) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgUserEmailNotFound });
  }

  try {
    var fetchAnnualSingleIssues = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 1,
      batchId: null
    }).lean();

    var fetchAnnualBatchIssues = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 1,
      batchId: { $ne: null }
    }).lean();

    var getSingleIssueDetailsMonthCount = await getAggregatedCertsDetails(fetchAnnualSingleIssues, year);
    var getBatchIssueDetailsMonthCount = await getAggregatedCertsDetails(fetchAnnualBatchIssues, year);

    const mergedDetails = getSingleIssueDetailsMonthCount.map((singleItem, index) => ({
      month: singleItem.month,
      count: [singleItem.count, getBatchIssueDetailsMonthCount[index].count]
    }));

    var responseData = mergedDetails.length == 12 ? mergedDetails : 0;

    // Send the fetched graph data as a response
    res.json({
      status: "SUCCESS",
      message: messageCode.msgGraphDataFetched,
      data: responseData,
    });
    return;
  } catch (error) {
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

const getAggregatedCertsDetails = async (data, year) => {

  // Function to extract month and year from lastUpdate field
  const getMonthYear = (entry) => {
    const date = moment(entry.lastUpdate);
    const year = date.year();
    return year;
  };

  // Filter data for the specified year
  const dataYear = data.filter(entry => {
    const entryYear = getMonthYear(entry);
    return entryYear === year;
  });

  // Count occurrences of each month
  const monthCounts = {};
  dataYear.forEach(entry => {
    const month = moment(entry.lastUpdate).month() + 1; // Adding 1 because moment.js months are 0-indexed
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });

  // Create array with counts for all months in the specified year
  const monthCountsArray = [];
  for (let i = 1; i <= 12; i++) {
    monthCountsArray.push({ month: i, count: monthCounts[i] || 0 });
  }

  return monthCountsArray;

};

/**
 * API to fetch Graph details with Query-parameter.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const fetchGraphStatusDetails = async (req, res) => {
  const _value = req.params.value; // Get the value from the URL parameter
  const email = req.params.email; // Get the email from the URL parameter

  // Get today's date
  var today = new Date();

  var value = parseInt(_value);
  // Check if value is between 1 and 12 and equal to 2024
  if ((value !== null && value !== '') && // Check if value is not null or empty
    ((value < 2000 || value > 2199) && (value < 1 || value > 12))) {
    // Send the fetched graph data as a response
    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGraphInput, details: value });
  }

  // Check mongoose connection
  const dbStatus = await isDBConnected();
  const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
  console.log(dbStatusMessage);

  if (dbStatus == false) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgDbError });
  }

  // Check if user with provided email exists
  const issuerExist = await User.findOne({ email: email });

  if (!issuerExist) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgUserEmailNotFound });
  }

  try {
    var fetchAllCertificateIssues = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 1
    }).lean();

    var fetchAllCertificateRenewes = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 2
    }).lean();

    var fetchAllCertificateRevoked = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 3
    }).lean();

    var fetchAllCertificateReactivated = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 4
    }).lean();
    // console.log("All status responses", fetchAllCertificateIssues.length, fetchAllCertificateRenewes.length, fetchAllCertificateRevoked.length, fetchAllCertificateReactivated.length);

    if (value > 2000 && value < 2199) {

      var getIssueDetailsMonthCount = await getAggregatedCertsDetails(fetchAllCertificateIssues, value);
      var getRenewDetailsMonthCount = await getAggregatedCertsDetails(fetchAllCertificateRenewes, value);
      var getRevokedDetailsMonthCount = await getAggregatedCertsDetails(fetchAllCertificateRevoked, value);
      var getReactivatedDetailsMonthCount = await getAggregatedCertsDetails(fetchAllCertificateReactivated, value);

      const mergedDetails = getIssueDetailsMonthCount.map((singleItem, index) => ({
        month: singleItem.month,
        count: [singleItem.count, getRenewDetailsMonthCount[index].count, getRevokedDetailsMonthCount[index].count, getReactivatedDetailsMonthCount[index].count]
      }));

      var responseData = mergedDetails.length > 1 ? mergedDetails : 0;

      // Send the fetched graph data as a response
      res.json({
        status: "SUCCESS",
        message: messageCode.msgGraphDataFetched,
        data: responseData,
      });
      return;
    } else if (value >= 1 && value <= 12) {

      var getIssueDetailsDaysCount = await getMonthAggregatedCertsDetails(fetchAllCertificateIssues, value, today.getFullYear());
      var getRenewDetailsDaysCount = await getMonthAggregatedCertsDetails(fetchAllCertificateRenewes, value, today.getFullYear());
      var getRevokedDetailsDaysCount = await getMonthAggregatedCertsDetails(fetchAllCertificateRevoked, value, today.getFullYear());
      var getReactivatedDetailsDaysCount = await getMonthAggregatedCertsDetails(fetchAllCertificateReactivated, value, today.getFullYear());

      const mergedDaysDetails = getIssueDetailsDaysCount.map((singleItem, index) => ({
        day: singleItem.day,
        count: [singleItem.count, getRenewDetailsDaysCount[index].count, getRevokedDetailsDaysCount[index].count, getReactivatedDetailsDaysCount[index].count]
      }));

      var responseData = mergedDaysDetails.length > 1 ? mergedDaysDetails : 0;

      // Send the fetched graph data as a response
      res.json({
        status: "SUCCESS",
        message: messageCode.msgGraphDataFetched,
        data: responseData,
      });

    } else {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGraphInput, details: value });
    }
  } catch (error) {
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

const getMonthAggregatedCertsDetails = async (data, month, year) => {

  // Function to extract month and year from lastUpdate field
  const getMonthYear = (entry) => {
    const date = moment(entry.lastUpdate);
    const year = date.year();
    return year;
  };

  // Function to get formatted month with leading zero if needed
  const getFormattedMonth = (month) => {
    return month < 10 ? "0" + month : month.toString();
  };

  // Filter data for the specified month and year
  const dataMonthYear = data.filter(entry => {
    const entryYear = getMonthYear(entry);
    const entryMonth = moment(entry.lastUpdate).month() + 1;
    return entryYear === year && entryMonth === month;
  });

  // Count occurrences of each day in the month
  const daysCounts = {};
  dataMonthYear.forEach(entry => {
    const day = moment(entry.lastUpdate).date();
    daysCounts[day] = (daysCounts[day] || 0) + 1;
  });

  // Create array with counts for all days in the specified month and year
  const daysCountsArray = [];
  const daysInMonth = moment(`${year}-${getFormattedMonth(month)}`, "YYYY-MM").daysInMonth();
  for (let i = 1; i <= daysInMonth; i++) {
    daysCountsArray.push({ day: i, count: daysCounts[i] || 0 });
  }

  return daysCountsArray;

};

const uploadCertificateToS3 = async (req, res) => {
  const file = req?.file;
  const filePath = file?.path;
  const certificateNumber = req?.body?.certificateNumber;
  const type = parseInt(req?.body?.type, 10); // Parse type to integer

  // Validate request parameters
  if (!file || !certificateNumber || !type) {
    return res.status(400).send({ status: "FAILED", message: "file, certificateId, and type are required" });
  }

  // Check if the certificate exists with the specified type
  let certificate;
  try {
    if (type === 1 || type === 2) {
      const typeField = type === 1 ? 'withpdf' : 'withoutpdf';
      certificate = await Issues.findOne({ certificateNumber: certificateNumber });
    } else if (type === 3) {
      certificate = await BatchIssues.findOne({ certificateNumber: certificateNumber });
    }

    if (!certificate) {
      return res.status(404).send({ status: "FAILED", message: "Certificate not found with the specified type" });
    }
  } catch (error) {
    console.error('Error finding certificate:', error);
    return res.status(500).send({ status: "FAILED", message: 'An error occurred while checking the certificate' });
  }

  const bucketName = process.env.BUCKET_NAME;
  const timestamp = Date.now(); // Get the current timestamp in milliseconds
  const keyName = `${file.originalname}_${timestamp}`;
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
        await updateIssuesSchema(certificateNumber, data.Location, 'withpdf');
        break;
      case 2:
        await updateIssuesSchema(certificateNumber, data.Location, 'withoutpdf');
        break;
      case 3:
        await updateBatchIssuesSchema(certificateNumber, data.Location);
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
async function updateIssuesSchema(certificateNumber, url, type) {
  try {
    // Update IssuesSchema using certificateId
    // Example code assuming mongoose is used for MongoDB
    await Issues.findOneAndUpdate(
      { certificateNumber: certificateNumber },
      { $set: { url: url, type: type } }
    );
  } catch (error) {
    console.error('Error updating IssuesSchema:', error);
    throw error;
  }
};

// Function to update BatchIssuesSchema for type 3
async function updateBatchIssuesSchema(certificateNumber, url) {
  try {
    // Update BatchIssuesSchema using certificateId
    // Example code assuming mongoose is used for MongoDB
    await BatchIssues.findOneAndUpdate(
      { certificateNumber: certificateNumber },
      { $set: { url: url } }
    );
  } catch (error) {
    console.error('Error updating BatchIssuesSchema:', error);
    throw error;
  }
};

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

// const getBatchCertificates = async (req, res) => {
//   try {
//     const { issuerId } = req.body;

//     // Validate issuerId
//     if (!issuerId) {
//       return res.status(400).json({ status: "FAILED", message: "issuerId is required" });
//     }

//     // Fetch all batch certificates for the given issuerId
//     const batchCertificates = await BatchIssues.find({ issuerId });

//     // Group certificates by issueDate
//     const groupedCertificates = batchCertificates.reduce((acc, certificate) => {
//       const issueDate = certificate.issueDate.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
//       if (!acc[issueDate]) {
//         acc[issueDate] = [];
//       }
//       acc[issueDate].push(certificate);
//       return acc;
//     }, {});

//     // Transform grouped certificates into an array of objects
//     const result = Object.keys(groupedCertificates).map(issueDate => ({
//       issueDate,
//       certificates: groupedCertificates[issueDate]
//     }));

//     // Respond with success and the grouped certificates
//     res.json({
//       status: 'SUCCESS',
//       data: result,
//       message: 'Batch certificates fetched successfully'
//     });
//   } catch (error) {
//     console.error('Error fetching batch certificates:', error);

//     // Respond with failure message
//     res.status(500).json({
//       status: 'FAILED',
//       message: 'An error occurred while fetching the batch certificates',
//       details: error.message
//     });
//   }
// };

const getBatchCertificateDates = async (req, res) => {
  try {
    const { issuerId } = req.body;

    // Validate issuerId
    if (!issuerId) {
      return res.status(400).json({ status: "FAILED", message: "issuerId is required" });
    }

    // Fetch all batch certificates for the given issuerId
    const batchCertificates = await BatchIssues.find({ issuerId }).sort({ issueDate: 1 });

    // Create a map to store the first certificate's issueDate for each batchId
    const batchDateMap = new Map();

    // Iterate through the certificates and store the first occurrence's issueDate for each batchId
    batchCertificates.forEach(cert => {
      if (!batchDateMap.has(cert.batchId)) {
        batchDateMap.set(cert.batchId, { issueDate: cert.issueDate, issuerId: cert.issuerId });
      }
    });

    // Convert the map to an array of objects with batchId, issueDate, and issuerId
    const uniqueBatchDates = Array.from(batchDateMap, ([batchId, value]) => ({
      batchId,
      issueDate: value.issueDate,
      issuerId: value.issuerId
    }));

    // Respond with success and the unique batch dates
    res.json({
      status: 'SUCCESS',
      data: uniqueBatchDates,
      message: 'Unique batch dates fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching unique batch dates:', error);

    // Respond with failure message
    res.status(500).json({
      status: 'FAILED',
      message: 'An error occurred while fetching the unique batch dates',
      details: error.message
    });
  }
};

const getBatchCertificates = async (req, res) => {
  try {
    const { batchId, issuerId } = req.body;

    // Validate input
    if (!batchId || !issuerId) {
      return res.status(400).json({ status: "FAILED", message: "batchId and issuerId are required" });
    }

    // Fetch all certificates for the given batchId and issuerId
    const certificates = await BatchIssues.find({ batchId, issuerId });

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

/**
 * Api to fetch Organtization details
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getOrganizationDetails = async (req, res) => {
  try {
    const organizations = await User.find({}, 'organization'); // Only select the 'organization' field
    res.json({
      status: "SUCCESS",
      message: messageCode.msgOrganizationFetched,
      data: organizations.map(user => user.organization),
    });
  } catch (err) {
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
}

module.exports = {
  // Function to get all issuers (users)
  getAllIssuers,

  // Function to fetch issuer details
  getIssuerByEmail,

  // Function to fetch verification details
  getVerificationDetailsByCourse,

  // Function to fetch details of Certification by giving name / certification ID.
  getIssueDetails,

  // Function to Upload Files to AWS-S3 bucket
  uploadFileToS3,

  // Function to fetch details from Issuers log
  fetchIssuesLogDetails,

  // Function to fetch details for Graph from Issuer log
  fetchGraphDetails,

  fetchGraphStatusDetails,

  uploadCertificateToS3,
  getSingleCertificates,
  getBatchCertificates,
  getBatchCertificateDates,
  getOrganizationDetails

};
