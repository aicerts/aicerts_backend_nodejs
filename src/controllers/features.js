// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const { validationResult } = require("express-validator");
const url = require('url');

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

const {
    handleRenewCertification,
    handleUpdateCertificationStatus,
    handleRenewBatchOfCertifications,
    handleUpdateBatchCertificationStatus } = require('../services/feature');

// Importing functions from a custom module
const {
    convertDateFormat,
    isCertificationIdExisted,
    isDBConnected
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

var messageCode = require("../common/codes");

// Import the Issues models from the schema defined in "../config/schema"
const { ShortUrl } = require("../config/schema");


/**
 * API call to renew a certification (single / in batch).
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const renewCert = async (req, res) => {
    var validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const certificateNumber = req.body.certificateNumber;
        var _expirationDate = req.body.expirationDate;

        if (req.body.expirationDate == "1" || req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
            var _expirationDate = 1;
        } else {
            var _expirationDate = await convertDateFormat(req.body.expirationDate);
        }
        if (_expirationDate == null) {
            res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
            return;
        }

        const renewResponse = await handleRenewCertification(email, certificateNumber, _expirationDate);
        var responseDetails = renewResponse.details ? renewResponse.details : '';
        if (renewResponse.code == 200) {
            return res.status(renewResponse.code).json({ status: renewResponse.status, message: renewResponse.message, qrCodeImage: renewResponse.qrCodeImage, polygonLink: renewResponse.polygonLink, details: responseDetails });
        }
        res.status(renewResponse.code).json({ status: renewResponse.status, message: renewResponse.message, details: responseDetails });
    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }
};

/**
 * API call to revoke/reactivate a certification status (single / in batch).
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const updateCertStatus = async (req, res) => {
    var validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        email = req.body.email;
        certificateNumber = req.body.certificateNumber;
        certStatus = req.body.certStatus;

        const updateResponse = await handleUpdateCertificationStatus(email, certificateNumber, certStatus);
        var responseDetails = updateResponse.details ? updateResponse.details : '';
        return res.status(updateResponse.code).json({ status: updateResponse.status, message: updateResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }
};

/**
 * API call for Batch Certificates Renewal.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const renewBatchCertificate = async (req, res) => {
    var validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const _batchId = req.body.batch;
        var expirationDate = req.body.expirationDate;
        if (req.body.expirationDate == "1" || req.body.expirationDate == "string" || req.body.expirationDate == null) {
            var expirationDate = 1;
        }
        var batchId = parseInt(_batchId);

        const batchResponse = await handleRenewBatchOfCertifications(email, batchId, expirationDate);
        if (!batchResponse) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        var responseDetails = batchResponse.details ? batchResponse.details : '';
        return res.status(batchResponse.code).json({ status: batchResponse.status, message: batchResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }
};

/**
 * API call to revoke/reactivate a Batch certification status.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const updateBatchStatus = async (req, res) => {
    var validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const _batchId = req.body.batch;
        const _batchStatus = req.body.status;
        var batchId = parseInt(_batchId);
        var batchStatus = parseInt(_batchStatus);

        const batchStatusResponse = await handleUpdateBatchCertificationStatus(email, batchId, batchStatus);
        if (!batchStatusResponse) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        var responseDetails = batchStatusResponse.details ? batchStatusResponse.details : '';
        return res.status(batchStatusResponse.code).json({ status: batchStatusResponse.status, message: batchStatusResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }
};

/**
 * API call to encode/decode for the Short URL.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const shortenUrlToVerify = async (req, res) => {
    var validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    const inputUrl = req.body.url;

    if (!inputUrl || !inputUrl.startsWith("https://verify")) {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidUrl });
    }

    var urlSize = inputUrl.length;

    if (urlSize < 40) {
        // Parse the URL
        const parsedUrl = new URL(inputUrl);
        // Extract the query parameter
        const certificationNumber = parsedUrl.searchParams.get('');
        try{
            var dbStatus = isDBConnected();

            var isCertExist = await isCertificationIdExisted(certificationNumber);

            
        console.log(certificationNumber, isCertExist);


        } catch(error) {
            return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        return res.status(200).json({ status: "WORKING", message: messageCode.msgWorkInProgress });
    } else {
        return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }

}

module.exports = {
    // Function to renew a certification (single / in batch)
    renewCert,

    // Function to revoke/reactivate a certification (single / in batch)
    updateCertStatus,

    // Function to renew a Batch certifications (the batch)
    renewBatchCertificate,

    // Function to revoke/reactivate a Batch of certifications
    updateBatchStatus,

    // Function to encode/decode for the Short URL.
    shortenUrlToVerify

};
