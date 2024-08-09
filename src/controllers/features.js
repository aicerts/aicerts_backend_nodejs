// Load environment variables from .env file
require('dotenv').config();
const path = require("path");
const fs = require("fs");
const ExcelJS = require('exceljs');

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
    isDBConnected,
    getIssuerServiceCredits,
    updateIssuerServiceCredits,
    cleanUploadFolder
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { convertToExcel } = require('../dist/convert');

var messageCode = require("../common/codes");

// Import the Issues models from the schema defined in "../config/schema"
const { User } = require("../config/schema");

var existIssuerId;


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

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await User.findOne({ email: email });
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'renew');
                    if (fetchCredits === true) {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus, details: email });
                    }
                    if (fetchCredits) {
                    } else {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded, details: email });
                    }
                } else {
                    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId, details: email });
                }
            }
        }

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
            // Update Issuer credits limit (decrease by 1)
            await updateIssuerServiceCredits(existIssuerId, 'renew');
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

        var serviceStatus = parseInt(certStatus) == 3 ? 'revoke' : 'reactivate';

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await User.findOne({ email: email });
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, serviceStatus);
                    if (fetchCredits === true) {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus, details: email });
                    }
                    if (fetchCredits) {
                    } else {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded, details: email });
                    }
                } else {
                    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId, details: email });
                }
            }
        }

        const updateResponse = await handleUpdateCertificationStatus(email, certificateNumber, certStatus);
        const responseDetails = updateResponse.details ? updateResponse.details : '';
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, serviceStatus);
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

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await User.findOne({ email: email });
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'renew');
                    if (fetchCredits === true) {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus, details: email });
                    }
                    if (fetchCredits) {
                    } else {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded, details: email });
                    }
                } else {
                    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId, details: email });
                }
            }
        }

        const batchResponse = await handleRenewBatchOfCertifications(email, batchId, expirationDate);
        if (!batchResponse) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'renew');
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

        var serviceStatus = parseInt(batchStatus) == 3 ? 'revoke' : 'reactivate';

        // Verify with existing credits limit of an issuer to perform the operation
        if (email) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
                var issuerExist = await User.findOne({ email: email });
                if (issuerExist && issuerExist.issuerId) {
                    existIssuerId = issuerExist.issuerId;
                    let fetchCredits = await getIssuerServiceCredits(existIssuerId, serviceStatus);
                    if (fetchCredits === true) {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus, details: email });
                    }
                    if (fetchCredits) {
                    } else {
                        return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded, details: email });
                    }
                } else {
                    return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId, details: email });
                }
            }
        }

        const batchStatusResponse = await handleUpdateBatchCertificationStatus(email, batchId, batchStatus);
        if (!batchStatusResponse) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, serviceStatus);
        const responseDetails = batchStatusResponse.details ? batchStatusResponse.details : '';
        return res.status(batchStatusResponse.code).json({ status: batchStatusResponse.status, message: batchStatusResponse.message, details: responseDetails });

    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
    }
};


/**
 * API call to convert json/csv/xml file into excel file extension.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const convertIntoExcel = async (req, res) => {

    // Check if the file path matches the pattern
    if (!req.file) {
        // File path does not match the pattern
        let errorMessage = messageCode.msgInvalidFile;
        await cleanUploadFolder();
        res.status(400).json({ status: "FAILED", message: errorMessage, details: req.file });
        return;
    }
    let originalName = req.file.originalname;
    const getExtension = path.extname(originalName).slice(1);
    const uploadDir = path.join(__dirname, '..', '..', './', req.file.path);
    console.log("the extension", getExtension);
    try {
        const email = req.body.email;
        let dbStatus = isDBConnected();
        if (dbStatus) {
            let isEmailExist = await User.findOne({ email: email });
            if (!isEmailExist) {
                res.status(400).json({ status: "FAILED", message: messageCode.msgUserEmailNotFound, details: email });
                return;
            }

            // let outputPath = path.join(__dirname, '../../uploads', `test.xlsx`);
            // console.log("Reached", req.file.originalname, uploadDir);

            const targetFileBuffer = await convertToExcel(uploadDir, getExtension);
            // console.log("The response", targetFileBuffer);

            if (!targetFileBuffer || targetFileBuffer == null) {
                res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToConvert });
                await cleanUploadFolder();
                return;
            }
            await cleanUploadFolder();

            const resultExcel = `converted.xlsx`;

            res.set({
                'Content-Type': "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                'Content-Disposition': `attachment; filename="${resultExcel}"`, // Change filename as needed
            });

            // Send excel file
            res.send(targetFileBuffer);
            return;
        }
    } catch (error) {
        await cleanUploadFolder();
        res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
        return;
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

    convertIntoExcel,

};
