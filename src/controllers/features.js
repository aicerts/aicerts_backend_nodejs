// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const { validationResult } = require("express-validator");

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
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

let messageCode = require("../common/codes");

// Import the Issues models from the schema defined in "../config/schema"
const { ShortUrl } = require("../config/schema");


/**
 * API call to renew a certification (single / in batch).
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const renewCert = async (req, res) => {
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }
    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const certificateNumber = req.body.certificateNumber;
        let _expirationDate = req.body.expirationDate;

        if (req.body.expirationDate == "1" || req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
            _expirationDate = 1;
        } else {
            _expirationDate = await convertDateFormat(req.body.expirationDate);
        }
        if (_expirationDate == null) {
            res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
            return;
        }

        const renewResponse = await handleRenewCertification(email, certificateNumber, _expirationDate);
        const responseDetails = renewResponse.details ? renewResponse.details : '';
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
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const certificateNumber = req.body.certificateNumber;
        const certStatus = req.body.certStatus;

        const updateResponse = await handleUpdateCertificationStatus(email, certificateNumber, certStatus);
        const responseDetails = updateResponse.details ? updateResponse.details : '';
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
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const _batchId = req.body.batch;
        let expirationDate = req.body.expirationDate;
        if (req.body.expirationDate == "1" || req.body.expirationDate == "string" || req.body.expirationDate == null) {
            expirationDate = 1;
        }
        let batchId = parseInt(_batchId);

        const batchResponse = await handleRenewBatchOfCertifications(email, batchId, expirationDate);
        if (!batchResponse) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        let responseDetails = batchResponse.details ? batchResponse.details : '';
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
    let validResult = validationResult(req);
    if (!validResult.isEmpty()) {
        return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
    }

    try {
        // Extracting required data from the request body
        const email = req.body.email;
        const _batchId = req.body.batch;
        const _batchStatus = req.body.status;
        const batchId = parseInt(_batchId);
        const batchStatus = parseInt(_batchStatus);

        const batchStatusResponse = await handleUpdateBatchCertificationStatus(email, batchId, batchStatus);
        if (!batchStatusResponse) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        const responseDetails = batchStatusResponse.details ? batchStatusResponse.details : '';
        return res.status(batchStatusResponse.code).json({ status: batchStatusResponse.status, message: batchStatusResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }
};

module.exports = {
    // Function to renew a certification (single / in batch)
    renewCert,

    // Function to revoke/reactivate a certification (single / in batch)
    updateCertStatus,

    // Function to renew a Batch certifications (the batch)
    renewBatchCertificate,

    // Function to revoke/reactivate a Batch of certifications
    updateBatchStatus,

};
