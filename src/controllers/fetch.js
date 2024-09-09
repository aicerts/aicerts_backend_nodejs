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
const { User, Issues, BatchIssues, IssueStatus, VerificationLog, ServiceAccountQuotas } = require("../config/schema");

// Importing functions from a custom module
const {
  holdExecution,
  validateSearchDateFormat,
  convertDateFormat,
  cleanUploadFolder,
  isDBConnected // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

// Define the API endpoint and parameters
const apiUrl = process.env.POLYGON_API_URL || null;
const polygonApiKey = process.env.POLYGON_API_KEY || null;
const netcomAddress = process.env.NETCOM_CONTRACT || null;
const lmsAddress = process.env.LMS_CONTRACT || null;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // 1 second delay between retries (adjust as needed)
const bucketName = process.env.BUCKET_NAME || 'certs365-live';
const cloudBucket = '.png';
const searchLimit = process.env.SEARCH_LIMIT || 20;

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
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
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
        code: 200, 
        status: 'SUCCESS',
        data: issuer,
        message: `Issuer with email ${email} fetched successfully`
      });
    } else {
      res.json({
        code: 400, 
        status: 'FAILED',
        message: `Issuer with email ${email} not found`
      });
    }
  } catch (error) {
    res.json({
      code: 400, 
      status: 'FAILED',
      message: messageCode.msgErrorOnFetching
    });
  }
};

/**
 * API to fetch Service limits details of Issuer .
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getServiceLimitsByEmail = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    const { email } = req.body;

    const issuerExist = await User.findOne({ email: email }).select('-password');
    if (!issuerExist || !issuerExist.issuerId) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuer, details: email });
    }

    var fetchServiceQuota = await ServiceAccountQuotas.find({
      issuerId: issuerExist.issuerId
    });

    if (!fetchServiceQuota || fetchServiceQuota.length < 1) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgMatchLimitsNotFound, details: email });
    }

    // Transform the original response
    let transformedResponse = fetchServiceQuota.map(item => ({
      serviceId: item.serviceId,
      limit: item.limit,
      status: item.status
    }));

    return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgMatchLimitsFound, details: transformedResponse });

  } catch (error) {
    res.json({
      code: 400, 
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
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  const input = req.body.input;
  const _type = req.body.type;
  const email = req.body.email;
  var responseData;

  if (!input || !email) {
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput });
  }

  var type = parseInt(_type);
  if (type != 1 && type != 2 && type != 3) {
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgTypeRestricted });
  }

  try {
    var dbStatus = await isDBConnected();

    if (dbStatus == false) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgDbNotReady });
    }

    // Check if user with provided email exists
    const issuerExist = await User.findOne({ email: email });

    if (!issuerExist) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserNotFound });
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
        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgIssueFound, data: responseData });
      }

    } catch (error) {
      return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
    }

    try {
      if (type == 1) {
        // check if the input is Existed cert ID or name for Renew
        var isIssueSingleName = Issues.find({
          issuerId: issuerExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: "$name" }, input.toLowerCase()] }
            ]
          },
          certificateStatus: { $in: [1, 2, 4] },
          expirationDate: { $ne: "1" }
        }).lean();

        var isIssueBatchName = BatchIssues.find({
          issuerId: issuerExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: "$name" }, input.toLowerCase()] }
            ]
          },
          certificateStatus: { $in: [1, 2, 4] },
          expirationDate: { $ne: "1" }
        }).lean();

      } else if (type == 2) {
        // check if the input is Existed cert ID or name for Reactivate
        var isIssueSingleName = Issues.find({
          issuerId: issuerExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: "$name" }, input.toLowerCase()] }
            ]
          },
          certificateStatus: 3
        }).lean();

        var isIssueBatchName = BatchIssues.find({
          issuerId: issuerExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: "$name" }, input.toLowerCase()] }
            ]
          },
          certificateStatus: 3
        }).lean();

      } else if (type == 3) {
        // check if the input is Existed cert ID or name for Revoke
        var isIssueSingleName = Issues.find({
          issuerId: issuerExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: "$name" }, input.toLowerCase()] }
            ]
          },
          certificateStatus: { $in: [1, 2, 4] }
        }).lean();

        var isIssueBatchName = BatchIssues.find({
          issuerId: issuerExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: "$name" }, input.toLowerCase()] }
            ]
          },
          certificateStatus: { $in: [1, 2, 4] }
        }).lean();
      }

      var [singleNameResponse, batchNameResponse] = await Promise.all([isIssueSingleName, isIssueBatchName]);
      console.log("batch response", batchNameResponse);
      if (singleNameResponse.length != 0 || batchNameResponse.length != 0) {
        if (singleNameResponse.length != 0 || batchNameResponse.length != 0) {
          responseData = singleNameResponse.length != 0 ? singleNameResponse : batchNameResponse;
        }
        if (singleNameResponse.length != 0 && batchNameResponse.length != 0) {
          responseData = [...singleNameResponse, ...batchNameResponse];
        }
        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgIssueFound, data: responseData });
      }
    } catch (error) {
      return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
    }

    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgIssueNotFound });

  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API to search issues based on filters.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getIssuersWithFilter = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    const input = req.body.input;
    const filter = req.body.filter;
    if (!filter || !input) {
      return res.status(400).send({ code: 400, status: "FAILED", message: messageCode.msgInputProvide });
    }

    var fetchResult;
    const query = {};
    query[filter] = { $regex: `^${input}`, $options: 'i' };
    fetchResult = await User.find(query).select(['-password']);

    if (fetchResult.length == 0) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
    }

    return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgAllIssuersFetched, details: fetchResult });
  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API to Fetch issues details as per the filter end user/ course name/ expiration date.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getIssuesWithFilter = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  var fetchedIssues = [];

  try {
    const input = req.body.input;
    const _filter = req.body.filter;
    const email = req.body.email;
    const flag = parseInt(req.body.flag);
    const filter = (_filter == 'certificationNumber') ? 'certificateNumber' : _filter;
    // Get page and limit from query parameters, with defaults
    var page = parseInt(req.query.page) || null;
    var limit = parseInt(req.query.limit) || null;
    var startIndex;
    var endIndex;
    await isDBConnected();
    const isEmailExist = await User.findOne({ email: email });
    if (!isEmailExist) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidEmail, details: email });
    }
    if (input && filter) {
      var filterCriteria = `$${filter}`;
      if (flag == 1) {
        // Query 1
        var query1Promise = Issues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $regexMatch: { input: { $toLower: filterCriteria }, regex: new RegExp(`^${input.toLowerCase()}`, 'i') } }
            ]
          },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Query 2
        var query2Promise = BatchIssues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $regexMatch: { input: { $toLower: filterCriteria }, regex: new RegExp(`^${input.toLowerCase()}`, 'i') } }
            ]
          },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Await both promises
        var [query1Result, query2Result] = await Promise.all([query1Promise, query2Promise]);
        // Check if results are non-empty and push to finalResults
        if (query1Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query1Result);
        }
        if (query2Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query2Result);
        }

        // Extract the key match from the results
        const responseItems = fetchedIssues.map(item => item[filter]);
        // Remove duplicates using a Set
        const uniqueItems = Array.from(new Set(responseItems));
        // const uniqueItems = [...new Set(responseItems.map(item => item.toLowerCase()))];
        // Sort the values alphabetically
        fetchResult = uniqueItems.sort((a, b) => a.localeCompare(b));
        // const fetchResult = uniqueItems.map(lowerCaseItem =>
        //   responseItems.find(item => item.toLowerCase() === lowerCaseItem)
        // );
        // Map and limit to specific number of items
        // const fetchResult = uniqueItems
        //   .map(lowerCaseItem => responseItems.find(item => item.toLowerCase() === lowerCaseItem))
        //   .slice(0, searchLimit);

        if (fetchResult.length == 0) {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
        }

        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgIssueFound, details: fetchResult });

      } else {

        // Query 1
        var query1Promise = Issues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: filterCriteria }, input.toLowerCase()] }
            ]
          },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Query 2
        var query2Promise = BatchIssues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: filterCriteria }, input.toLowerCase()] }
            ]
          },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Await both promises
        var [query1Result, query2Result] = await Promise.all([query1Promise, query2Promise]);
        // Check if results are non-empty and push to finalResults
        if (query1Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query1Result);
        }
        if (query2Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query2Result);
        }

        if (!page || !limit || page == 0 || limit == 0) {
          page = 1;
          limit = fetchedIssues.length;
          // Calculate the start and end indices for the slice
          startIndex = (page - 1) * limit;
          endIndex = startIndex + limit;
        } else {
          // Calculate the start and end indices for the slice
          startIndex = (page - 1) * limit;
          endIndex = startIndex + limit;
        }

        // Calculate total number of pages
        const totalItems = fetchedIssues.length;
        const totalPages = Math.ceil(totalItems / limit);

        // Slice the array to get the current page of results
        const paginatedData = fetchedIssues.slice(startIndex, endIndex);

        const paginationDetails = {
          total: totalItems,
          page: page,
          limit: limit,
          totalPages: totalPages
        }

        if (fetchedIssues.length == 0) {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
        }
        // Check if the requested page is beyond the total pages
        if (page > totalPages && totalPages > 0) {
          return res.status(404).json({
            code: 404,
            status: "SUCCESS", 
            message: messageCode.msgPageNotFound,
            data: [],
            pagination: paginationDetails
          });
        }

        const matchPages = {
          data: paginatedData,
          ...paginationDetails
        }

        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgIssueFound, details: matchPages });
      }
    } else {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput, detail: input });
    }

  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API to Fetch issues details (for renew/revoke/reactivation) as per the filter end user/ course name/ expiration date.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const adminSearchWithFilter = async(req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  var fetchedIssues = [];

  try {
    const input = req.body.input;
    const _filter = req.body.filter;
    const email = req.body.email;
    const flag = parseInt(req.body.flag);
    const filter = (_filter == 'certificationNumber') ? 'certificateNumber' : _filter;
    const status = parseInt(req.body.status);
    // Get page and limit from query parameters, with defaults
    var page = parseInt(req.query.page) || null;
    var limit = parseInt(req.query.limit) || null;
    var startIndex;
    var endIndex;
    var certStatusFilter;
    var expirationDateFilter = null;
    await isDBConnected();
    const isEmailExist = await User.findOne({ email: email });
    if (!isEmailExist) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidEmail, details: email });
    }

    if(!status){
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidStatusValue});
    }

    if(status == 1){
      certStatusFilter = [1, 2, 4];
      expirationDateFilter = "1";
    } else if(status == 2){
      certStatusFilter = [3];
    } else if (status == 3){
      certStatusFilter = [1, 2, 4];
    }

    if (input && filter) {
      var filterCriteria = `$${filter}`;
      if (flag == 1) {
        // Query 1
        var query1Promise = Issues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $regexMatch: { input: { $toLower: filterCriteria }, regex: new RegExp(`^${input.toLowerCase()}`, 'i') } }
            ]
          },
          certificateStatus: { $in: certStatusFilter },
          expirationDate: { $ne: expirationDateFilter },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Query 2
        var query2Promise = BatchIssues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $regexMatch: { input: { $toLower: filterCriteria }, regex: new RegExp(`^${input.toLowerCase()}`, 'i') } }
            ]
          },
          certificateStatus: { $in: certStatusFilter },
          expirationDate: { $ne: expirationDateFilter },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Await both promises
        var [query1Result, query2Result] = await Promise.all([query1Promise, query2Promise]);
        // Check if results are non-empty and push to finalResults
        if (query1Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query1Result);
        }
        if (query2Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query2Result);
        }

        // Extract the key match from the results
        const responseItems = fetchedIssues.map(item => item[filter]);
        // Remove duplicates using a Set
        const uniqueItems = Array.from(new Set(responseItems));
        // Sort the values alphabetically
        fetchResult = uniqueItems.sort((a, b) => a.localeCompare(b));

        if (fetchResult.length == 0) {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
        }

        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgIssueFound, details: fetchResult });

      } else {

        // Query 1
        var query1Promise = Issues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: filterCriteria }, input.toLowerCase()] }
            ]
          },
          certificateStatus: { $in: certStatusFilter },
          expirationDate: { $ne: expirationDateFilter },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Query 2
        var query2Promise = BatchIssues.find({
          issuerId: isEmailExist.issuerId,
          $expr: {
            $and: [
              { $eq: [{ $toLower: filterCriteria }, input.toLowerCase()] }
            ]
          },
          certificateStatus: { $in: certStatusFilter },
          expirationDate: { $ne: expirationDateFilter },
          url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
        });

        // Await both promises
        var [query1Result, query2Result] = await Promise.all([query1Promise, query2Promise]);
        // Check if results are non-empty and push to finalResults
        if (query1Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query1Result);
        }
        if (query2Result.length > 0) {
          fetchedIssues = fetchedIssues.concat(query2Result);
        }

        if (!page || !limit || page == 0 || limit == 0) {
          page = 1;
          limit = fetchedIssues.length;
          // Calculate the start and end indices for the slice
          startIndex = (page - 1) * limit;
          endIndex = startIndex + limit;
        } else {
          // Calculate the start and end indices for the slice
          startIndex = (page - 1) * limit;
          endIndex = startIndex + limit;
        }

        // Calculate total number of pages
        const totalItems = fetchedIssues.length;
        const totalPages = Math.ceil(totalItems / limit);

        // Slice the array to get the current page of results
        const paginatedData = fetchedIssues.slice(startIndex, endIndex);

        const paginationDetails = {
          total: totalItems,
          page: page,
          limit: limit,
          totalPages: totalPages
        }

        if (fetchedIssues.length == 0) {
          return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
        }
        // Check if the requested page is beyond the total pages
        if (page > totalPages && totalPages > 0) {
          return res.status(404).json({
            code: 404,
            status: "SUCCESS", 
            message: messageCode.msgPageNotFound,
            data: [],
            pagination: paginationDetails
          });
        }

        const matchPages = {
          data: paginatedData,
          ...paginationDetails
        }

        return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgIssueFound, details: matchPages });
      }
    } else {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidInput, detail: input });
    }

  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError });
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
  const acl = process.env.ACL_NAME;

  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(filePath);

  const uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ACL: acl
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    console.log('File uploaded successfully to', data.Location);
    res.status(200).send({ code: 200, status: "SUCCESS", message: 'File uploaded successfully', fileUrl: data.Location });
    // await cleanUploadFolder();
    // Clean up the upload file
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    // await cleanUploadFolder();
    // Clean up the upload file
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    res.status(500).send({ code: 500, status: "FAILED", error: 'An error occurred while uploading the file', details: error });
    return;
  }
};

/**
 * API to fetch details of Verification results input as Course name.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getVerificationDetailsByCourse = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {

    const email = req.body.email;
    // Check mongoose connection
    const dbStatus = await isDBConnected();

    const isEmailExist = await User.findOne({ email: email });

    if (!isEmailExist) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserEmailNotFound });
    }

    const verificationCommonResponse = await VerificationLog.findOne({ email: email });

    if (verificationCommonResponse) {
      var responseCount = verificationCommonResponse.courses;
      res.status(200).json({
        code: 200, 
        status: 'SUCCESS',
        data: responseCount,
        message: `Verification results fetched successfully with searched course`
      });
      return;
    } else {
      res.status(400).json({
        code: 400, 
        status: 'FAILED',
        data: 0,
        message: `No verification results found`
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      code: 500, 
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
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
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
    var queryResponse;

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
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserNotFound });
    }

    if (queryCode || queryParams) {
      var inputQuery = parseInt(queryCode || queryParams);
      switch (inputQuery) {
        case 1:  // Get the all issued certs count
          var issueCount = issuerExist.certificatesIssued;

          // var query1Promise = Issues.find({
          //   issuerId: issuerExist.issuerId,
          //   url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
          // }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // var query2Promise = BatchIssues.find({
          //   issuerId: issuerExist.issuerId,
          //   url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
          // }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // // Wait for both queries to resolve
          // var [queryResponse1, queryResponse2] = await Promise.all([query1Promise, query2Promise]);

          // // Merge the results into a single array
          // var _queryResponse = [...queryResponse1, ...queryResponse2];
          // let issueCount = _queryResponse.length;

          var renewCount = issuerExist.certificatesRenewed;

          // var query11Promise = Issues.find({
          //   issuerId: issuerExist.issuerId,
          //   certificateStatus: { $in: [2] },
          //   url: { $exists: true,  $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
          // }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // var query21Promise = BatchIssues.find({
          //   issuerId: issuerExist.issuerId,
          //   certificateStatus: { $in: [2] },
          //   url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
          // }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // // Wait for both queries to resolve
          // var [queryResponse11, queryResponse21] = await Promise.all([query11Promise, query21Promise]);

          // // Merge the results into a single array
          // var _queryResponse1 = [...queryResponse11, ...queryResponse21];
          // var renewCount = _queryResponse1.length;

          var revokedCount = await IssueStatus.find({
            email: req.body.email,
            certStatus: 3
          });
          var reactivatedCount = await IssueStatus.find({
            email: req.body.email,
            certStatus: 4
          });
          queryResponse = { issued: issueCount, renewed: renewCount, revoked: revokedCount.length, reactivated: reactivatedCount.length };
          break;
        case 2:
          queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [
              { certStatus: { $eq: [1, 2] } },
              { expirationDate: { $gt: formattedDate } }]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          // queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 3:
          queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: [1, 2] }, expirationDate: { $ne: "1" } }]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          // queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 4:
          queryResponse = await IssueStatus.find({
            email: req.body.email,
            $and: [{ certStatus: { $eq: 3 }, expirationDate: { $gt: formattedDate } }]
          });
          // Sort the data based on the 'lastUpdate' date in descending order
          queryResponse.sort((b, a) => new Date(b.expirationDate) - new Date(a.expirationDate));
          break;
        case 5:
          queryResponse = await IssueStatus.find({
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
            certificateStatus: { $in: [1, 2, 4] },
            url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          var query2Promise = BatchIssues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2, 4] },
            url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
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
          queryResponse = filteredResponse6;
          break;
        case 7://To fetch Revoked certifications and count
          var query1Promise = Issues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: 3,
            url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          var query2Promise = BatchIssues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: 3,
            url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // Wait for both queries to resolve
          var [queryResponse1, queryResponse2] = await Promise.all([query1Promise, query2Promise]);

          // Merge the results into a single array
          var _queryResponse = [...queryResponse1, ...queryResponse2];
          // Sort the data based on the 'issueDate' date in descending order
          _queryResponse.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

          // Take only the first 30 records
          queryResponse = _queryResponse.slice(0, Math.min(_queryResponse.length, 30));
          break;
        case 8:
          var filteredResponse8 = [];
          var query1Promise = Issues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2, 4] },
            expirationDate: { $ne: "1" },
            url: { $exists: true, $ne: null, $ne: "", $regex: bucketName } // Filter to include documents where `url` exists
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          var query2Promise = BatchIssues.find({
            issuerId: issuerExist.issuerId,
            certificateStatus: { $in: [1, 2, 4] },
            expirationDate: { $ne: "1" },
            url: { $exists: true, $ne: null, $ne: "", $regex: bucketName } // Filter to include documents where `url` exists
          }).lean(); // Use lean() to convert documents to plain JavaScript objects

          // Wait for both queries to resolve
          var [queryResponse1, queryResponse2] = await Promise.all([query1Promise, query2Promise]);

          // Merge the results into a single array
          var queryResponse = [...queryResponse1, ...queryResponse2];

          // Filter the data to show only expiration dates on or after today
          queryResponse = queryResponse.filter(item => new Date(item.expirationDate) >= new Date(todayDate));

          // Sort the data based on the 'expirationDate' date in descending order
          queryResponse.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

          // Sort the data based on the 'issueDate' date in descending order
          // queryResponse.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

          for (let item8 of queryResponse) {
            let certificateNumber = item8.certificateNumber;
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
          queryResponse = filteredResponse8;
          break;
        case 9:
          var queryResponse = await Issues.find({
            issuerId: issuerExist.issuerId,
            $and: [{ certificateStatus: { $eq: 4 } }]
          });
          break;
        default:
          queryResponse = 0;
          var totalResponses = 0;
          var responseMessage = messageCode.msgNoMatchFound;
      };
    } else {
      queryResponse = 0;
      var totalResponses = 0;
      var responseMessage = messageCode.msgNoMatchFound;
    }

    var totalResponses = queryResponse.length || Object.keys(queryResponse).length;
    var responseStatus = totalResponses > 0 ? 'SUCCESS' : 'FAILED';
    var responseCode = totalResponses > 0 ? 200 : 400;
    var responseMessage = totalResponses > 0 ? messageCode.msgAllQueryFetched : messageCode.msgNoMatchFound;

    // Respond with success and all user details
    res.json({
      code: responseCode, 
      status: responseStatus,
      data: queryResponse,
      responses: totalResponses,
      message: responseMessage
    });

  } catch (error) {
    // Error occurred while fetching user details, respond with failure message
    res.json({
      code: 400, 
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
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidGraphInput, details: year });
  }

  // Check mongoose connection
  const dbStatus = await isDBConnected();
  const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
  console.log(dbStatusMessage);

  if (dbStatus == false) {
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgDbError });
  }

  // Check if user with provided email exists
  const issuerExist = await User.findOne({ email: email });

  if (!issuerExist) {
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserEmailNotFound });
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
      code: 200, 
      status: "SUCCESS",
      message: messageCode.msgGraphDataFetched,
      data: responseData,
    });
    return;
  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
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
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidGraphInput, details: value });
  }

  // Check mongoose connection
  const dbStatus = await isDBConnected();
  const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
  console.log(dbStatusMessage);

  if (dbStatus == false) {
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgDbError });
  }

  // Check if user with provided email exists
  const issuerExist = await User.findOne({ email: email });

  if (!issuerExist) {
    return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserEmailNotFound });
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
        code: 200, 
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
        code: 200, 
        status: "SUCCESS",
        message: messageCode.msgGraphDataFetched,
        data: responseData,
      });

    } else {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgInvalidGraphInput, details: value });
    }
  } catch (error) {
    return res.status(500).json({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
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

/**
 * API to fetch issue details (core, feature) weekly, monthly, annually.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const fetchStatusCoreFeatureIssues = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  const email = req.body.email;

  try {
    await isDBConnected();
    // Check if user with provided email exists
    const issuerExist = await User.findOne({ email: email });
    if (!issuerExist) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgUserEmailNotFound, details: email });
    }

    var fetchAllIssues = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 1
    }).lean();

    var fetchAllRenews = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 2
    }).lean();

    var fetchAllRevokes = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 3
    }).lean();

    var fetchAllReactivates = await IssueStatus.find({
      email: issuerExist.email,
      certStatus: 4
    }).lean();

    // Wait for both queries to resolve
    var [queryIssues, queryRenews, queryRevokes, queryReactivates] = await Promise.all([fetchAllIssues, fetchAllRenews, fetchAllRevokes, fetchAllReactivates]);

    if (queryIssues.length == 0 && queryRenews.length == 0 && queryRevokes.length == 0 && queryReactivates.length == 0) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
    }

    // Process all data concurrently
    const [getIssues, getRenews, getRevokes, getReactivates] = await Promise.all([
      getAggregatedCoreDetails(queryIssues),
      getAggregatedCoreDetails(queryRenews),
      getAggregatedCoreDetails(queryRevokes),
      getAggregatedCoreDetails(queryReactivates)
    ]);

    let getResponse = {
      issues: getIssues,
      renews: getRenews,
      revoke: getRevokes,
      reactivate: getReactivates
    }
    return res.status(200).send({ code: 200, status: "SUCCESS", message: messageCode.msgAllIssuersFetched, details: getResponse });

  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }

};

const getAggregatedCoreDetails = async (data) => {
  // Function to get counts of records for a given date range
  const getCountForRange = (startDate, endDate) => {
    return data.filter(entry => {
      const entryDate = moment(entry.lastUpdate);
      return entryDate.isBetween(startDate, endDate, null, '[]');
    }).length;
  };

  // Define the date ranges
  const now = moment();
  const past7DaysStart = now.clone().subtract(7, 'days').startOf('day');
  const past30DaysStart = now.clone().subtract(30, 'days').startOf('day');
  const pastYearStart = now.clone().subtract(1, 'year').startOf('day');

  // Calculate counts for each range
  const past7DaysCount = getCountForRange(past7DaysStart, now);
  const past30DaysCount = getCountForRange(past30DaysStart, now);
  const pastYearCount = getCountForRange(pastYearStart, now);

  // Return the results
  return {
    week: past7DaysCount,
    month: past30DaysCount,
    year: pastYearCount
  };
};

const uploadCertificateToS3 = async (req, res) => {
  const file = req?.file;
  const filePath = file?.path;
  const certificateNumber = req?.body?.certificateNumber;
  const type = parseInt(req?.body?.type, 10); // Parse type to integer
  // Validate request parameters
  if (!file || !certificateNumber || !type) {
    return res.status(400).send({ code: 400, status: "FAILED", message: "file, certificateId, and type are required" });
  }

  // Check if the certificate exists with the specified type
  var certificate;
  try {
    if (type === 1 || type === 2) {
      const typeField = type === 1 ? 'withpdf' : 'withoutpdf';
      certificate = await Issues.findOne({ certificateNumber: certificateNumber });
    } else if (type === 3) {
      certificate = await BatchIssues.findOne({ certificateNumber: certificateNumber });
    }

    if (!certificate) {
      return res.status(400).send({ code: 400, status: "FAILED", message: "Certificate not found with the specified type" });
    }
  } catch (error) {
    console.error('Error finding certificate:', error);
    return res.status(500).send({ code: 500, status: "FAILED", message: 'An error occurred while checking the certificate' });
  }

  const bucketName = process.env.BUCKET_NAME;
  const timestamp = Date.now(); // Get the current timestamp in milliseconds
  const _keyName = `${certificateNumber}.png`;
  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(filePath);
  const acl = process.env.ACL_NAME;

  const keyPrefix = 'issues/';
  const keyName = keyPrefix + _keyName;

  const uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ACL: acl
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
        // await cleanUploadFolder();
        // Clean up the upload file
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return res.status(400).send({ code: 400, status: "FAILED", message: 'Invalid type' });
    }
    // await cleanUploadFolder();
    // Clean up the upload file
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    res.status(200).send({ code: 200, status: "SUCCESS", message: 'File uploaded successfully', fileUrl: data.Location });
    return;
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ code: 500, status: "FAILED", message: 'An error occurred while uploading the file', details: error.message });
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
      return res.status(400).json({ code: 400, status: "FAILED", message: "issuerId and valid type (1 or 2) are required" });
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
      return res.status(400).json({ code: 400, status: "FAILED", message: "Invalid type provided" });
    }

    // Fetch certificates based on issuerId and type
    const certificates = await Issues.find({
      issuerId: issuerId,
      type: typeField,
      url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
    });

    // Respond with success and the certificates
    res.json({
      code: 200, 
      status: 'SUCCESS',
      data: certificates,
      message: 'Certificates fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);

    // Respond with failure message
    res.status(500).json({
      code: 500, 
      status: 'FAILED',
      message: 'An error occurred while fetching the certificates',
      details: error.message
    });
  }
};

const getBatchCertificateDates = async (req, res) => {
  try {
    const { issuerId } = req.body;

    // Validate issuerId
    if (!issuerId) {
      return res.status(400).json({ code: 400, status: "FAILED", message: "issuerId is required" });
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
      code: 200, 
      status: 'SUCCESS',
      data: uniqueBatchDates,
      message: 'Unique batch dates fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching unique batch dates:', error);

    // Respond with failure message
    res.status(500).json({
      code: 500, 
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
      return res.status(400).json({ code: 400, status: "FAILED", message: "batchId and issuerId are required" });
    }

    // Fetch all certificates for the given batchId and issuerId
    const certificates = await BatchIssues.find({ batchId, issuerId });

    // Respond with success and the certificates
    res.json({
      code: 200, 
      status: 'SUCCESS',
      data: certificates,
      message: 'Certificates fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);

    // Respond with failure message
    res.status(500).json({
      code: 500, 
      status: 'FAILED',
      message: 'An error occurred while fetching the certificates',
      details: error.message
    });
  }
};

/**
 * Api to fetch Organtization details (Mobile Application)
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getOrganizationDetails = async (req, res) => {
  try {
    let organizations = await User.find({}, 'organization'); // Only select the 'organization' field
    let _organizations = organizations.map(user => user.organization);
    // Use Set to filter unique values
    let uniqueResponses = [...new Set(_organizations.map(item => item))];
    // Sort the array in alphabetical order
    const sortedUniqueResponses = uniqueResponses.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    res.json({
      code: 200, 
      status: "SUCCESS",
      message: messageCode.msgOrganizationFetched,
      data: sortedUniqueResponses
    });
  } catch (err) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: err });
  }
};

/**
 * Api to fetch Issues details as per Issuers in the oganization (Mobile Application)
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getIssuesInOrganizationWithName = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  const organization = req.body.organization;
  const targetName = req.body.name;
  var fetchedIssues = [];

  try {
    var dbStatus = await isDBConnected();

    if (dbStatus == false) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgDbNotReady });
    }

    const getIssuers = await User.find({

      $expr: {
        $and: [
          { $eq: [{ $toLower: "$organization" }, organization.toLowerCase()] }
        ]
      },
    });

    if (getIssuers && getIssuers.length > 0) {
      // Extract issuerIds
      var getIssuerIds = getIssuers.map(item => item.issuerId);
    } else {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
    }

    for (let i = 0; i < getIssuerIds.length; i++) {
      const currentIssuerId = getIssuerIds[i];

      // Query 1
      var query1Promise = Issues.find({
        issuerId: currentIssuerId,
        $expr: {
          $and: [
            { $eq: [{ $toLower: "$name" }, targetName.toLowerCase()] }
          ]
        },
        url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
      });

      // Query 2
      var query2Promise = BatchIssues.find({
        issuerId: currentIssuerId,
        $expr: {
          $and: [
            { $eq: [{ $toLower: "$name" }, targetName.toLowerCase()] }
          ]
        },
        url: { $exists: true, $ne: null, $ne: "", $regex: cloudBucket } // Filter to include documents where `url` exists
      });

      // Await both promises
      var [query1Result, query2Result] = await Promise.all([query1Promise, query2Promise]);
      // Check if results are non-empty and push to finalResults
      if (query1Result.length > 0) {
        // fetchedIssues.push(query1Result);
        fetchedIssues = fetchedIssues.concat(query1Result);
      }
      if (query2Result.length > 0) {
        // fetchedIssues.push(query2Result);
        fetchedIssues = fetchedIssues.concat(query2Result);
      }
    }

    if (fetchedIssues.length == 0) {
      return res.status(400).json({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFound });
    }

    return res.status(200).json({ code: 200, status: "SUCCESS", message: messageCode.msgAllQueryFetched, response: fetchedIssues });

  } catch (error) {
    return res.status(500).json({ code: 500, status: "FAILED", message: messageCode.msgInternalError, error: error });
  }

};

/**
 * Api to fetch Daily and Monthly issues (by LMS and Netcom).
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const fetchCustomIssuedCertificates = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ code: 422, status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  const email = req.body.email; // Get the email

  const today = new Date();
  const contractAddresses = [netcomAddress, lmsAddress];
  try {

    if (!apiUrl || !polygonApiKey) {
      return res.status(400).send({ code: 400, status: "FAILED", message: msgInvalidPolygonCredentials });
    }
    const issuesCount = {
      // Day: [],
      Week: [],
      Month: [],
      Annual: []
    };

    // Define date ranges
    const dateRanges = [
      // { name: "Day", startDate: await getPastDate(today, 1), endDate: today },
      { name: "Week", startDate: await getPastDate(today, 7), endDate: today },
      { name: "Month", startDate: await getPastDate(today, 30), endDate: today },
      { name: "Annual", startDate: await getPastDate(today, 365), endDate: today }
    ];

    for (const addressIndex of contractAddresses) {
      for (const range of dateRanges) {
        await holdExecution(350);
        let _startDate = range.startDate != 0 ? range.startDate.toISOString().split('T')[0] : 0;
        let _endDate = range.endDate.toISOString().split('T')[0];
        let fetchDetails = await fetchTransactionCountWithRetry(addressIndex, _startDate, _endDate);
        if (fetchDetails !== 0) {
          issuesCount[range.name].push(fetchDetails);
        }
      }
    }

    return res.status(200).json({ code: 200, status: "SUCCESS", message: `${messageCode.msgAllQueryFetched}:[Netcom, LMS]`, details: issuesCount });

  } catch (error) {
    res.status(400).json({
      status: 'FAILED',
      message: messageCode.msgFailedToFetch,
      details: error
    });
  }
};

// Retry function to handle failed case
const fetchTransactionCountWithRetry = async (addressIndex, startDate, endDate, retryCount = 0) => {

  try {
    return await fetchTransactionCount(addressIndex, startDate, endDate);
  } catch (error) {
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      console.log(`Retrying... Attempt ${retryCount + 1}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return fetchTransactionCountWithRetry(addressIndex, startDate, endDate, retryCount + 1);
    } else {
      console.error(`Max retries exceeded. Failed to fetch details for ${addressIndex} (${startDate} - ${endDate})`);
      throw error; // Propagate the error if retries are exhausted
    }
  }
}

// Function to fetch required details from the Smart Contract logs (within the date range)
const fetchTransactionCount = async (contractAddress, startDate, endDate) => {
  let module = 'account';
  let action = 'txlist';
  let fromBlock = 0;  // Starting block number (optional)
  let toBlock = 99999999;  // Ending block number (optional)
  let apiKey = polygonApiKey;

  const startTimestamp = startDate != 0 ? await toUnixTimestamp(startDate) : 0;
  const endTimestamp = await toUnixTimestamp(endDate);
  // Address of the specific user whose transactions/logs you want to filter
  // const userAddress = '0xUserAddress';

  // const url = `${apiUrl}?module=${module}&action=${action}&address=${contractAddress}&fromBlock=${fromBlock}&toBlock=${toBlock}&topic0=0x${web3.utils.padLeft(userAddress.toLowerCase(), 64)}&apikey=${apiKey}`;

  const url = `${apiUrl}?module=${module}&action=${action}&address=${contractAddress}&startblock=${fromBlock}&endblock=${toBlock}&sort=asc&apikey=${apiKey}`;


  try {
    // Dynamically import fetch
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      if (startDate != 0) {
        const transactions = data.result.filter(tx => tx.timeStamp >= startTimestamp && tx.timeStamp <= endTimestamp);
        return transactions.length;
      } else {
        let _transactions = data.result;
        return _transactions.length;
      }
    } else {
      console.error(`Error fetching data for contract ${contractAddress}: ${data.message}`);
      return 0;
    }
  } catch (error) {
    console.error(`Error fetching data for contract ${contractAddress}:`, error);
    return 0;
  }
};

/**
 * API to search and fetch Files from AWS-S3 bucket
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getBulkBackupFiles = async (req, res) => {
  var _searchDate = req.body.search;
  const issueType = req.body.category;
  const searchDate = await validateSearchDateFormat(_searchDate);
  if (searchDate == null || searchDate == "string" || (issueType != 1 && issueType != 2)) {
    return res.status(400).send({ code: 400, status: "FAILED", message: 'Invalid input provided', details: _searchDate });
  }

  // Split the input date string into month, day, and year
  const [month, day, year] = searchDate.split('-');

  // Create a new Date object using the provided values
  const dateObject = new Date(`${year}-${month}-${day}`);

  // Format the date using ISO 8601 format
  const searchDateFormated = dateObject.toISOString();

  const s3 = new AWS.S3();
  const bucketName = process.env.BUCKET_NAME;
  var fileData = [];

  if (issueType == 1) {
    var folderPath = 'bulkbackup/Single Issuance/';
  } else {
    var folderPath = 'bulkbackup/Batch Issuance/';
  }

  try {
    const params = {
      Bucket: bucketName,
      Prefix: folderPath
    };
    // List objects in the specified bucket and path
    const data = await listObjects(params);

    // Filter objects based on search date
    var filesToDownload = await filterObjectsByDate(data.Contents, searchDateFormated);
    if (filesToDownload.length > 0) {
      try {
        for (let i = 0; i < filesToDownload.length; i++) {
          var fileKey = filesToDownload[i];
          const downloadParams = {
            Bucket: bucketName, // Replace with your bucket name
            Key: fileKey,
            Expires: 360000,
          };
          try {
            const url = await s3.getSignedUrlPromise('getObject', downloadParams);
            fileData.push(url);
          } catch (error) {
            console.error(messageCode.msgErrorInUrl, error);
            res.status(400).send({ code: 400, status: "FAILED", message: messageCode.msgErrorInUrl, details: searchDate });
          }
        }
        res.status(200).send({ code: 200, status: "SUCCESS", message: messageCode.msgFilesFetchedSuccess, details: fileData });
        return;
      } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).send({ code: 500, status: "FAILED", message: messageCode.msgErrorInFetching, details: error });
      }
    } else {
      res.status(400).send({ code: 400, status: "FAILED", message: messageCode.msgNoMatchFoundInDates, details: searchDate });
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Convert date to Unix timestamp
const toUnixTimestamp = async (date) => {
  return Math.floor(new Date(date).getTime() / 1000);
}

// Function to get past date
const getPastDate = async (currentDate, daysAgo) => {
  const pastDate = new Date(currentDate);
  pastDate.setDate(currentDate.getDate() - daysAgo);
  return pastDate;
}

// Function to list objects in S3 bucket
const listObjects = async (params) => {
  var s3 = new AWS.S3();
  return new Promise((resolve, reject) => {
    s3.listObjectsV2(params, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

// Function to filter objects based on date
const filterObjectsByDate = async (data, inputDate) => {
  const filteredData = [];
  const inputDateTime = await trimDate(inputDate);

  for (const item of data) {
    var lastModifiedDateTime = await trimDate(item.LastModified);
    if (lastModifiedDateTime === inputDateTime) {
      filteredData.push(item.Key);
    }
  }
  return filteredData;
}

const trimDate = async (dateString) => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + date.getUTCDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

module.exports = {
  // Function to get all issuers (users)
  getAllIssuers,

  // Function to fetch issuer details
  getIssuerByEmail,

  // Function to fetch issuer limits details
  getServiceLimitsByEmail,

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

  // Function to fetch Core features count based response on monthly/yearly for the Graph
  fetchGraphStatusDetails,

  // Function to fetch Core features count based response for the Graph
  fetchStatusCoreFeatureIssues,

  // Function to upload media file into the S3 bucket provided
  uploadCertificateToS3,

  // Function to get single issued certifications from the DB (with / without pdf)
  getSingleCertificates,

  // Function to get batch issued certifications from the DB
  getBatchCertificates,

  // Function to get batch issued certifications from the DB based on Dates
  getBatchCertificateDates,

  // Function to fetch only organization details provided in issuers/users collection
  getOrganizationDetails,

  // Function to fetch only organization based issues 
  getIssuesInOrganizationWithName,

  // Function to fetch Netcom & LMS based issues count
  fetchCustomIssuedCertificates,

  // Function to fetch bulk backup files from S3 bucket based on the date
  getBulkBackupFiles,

  // Function to fetch only issuers based on the filter (name/email/organization)
  getIssuersWithFilter,

  // Function to fetch issues/Gallery certs based on the flag based filter (certificationId, name, course, grantDate, expirationDate)
  getIssuesWithFilter,

  adminSearchWithFilter,

};
