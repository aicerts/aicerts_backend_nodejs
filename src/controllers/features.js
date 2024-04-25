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

var messageCode = require("../common/codes");

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
        const expirationDate = req.body.expirationDate;
        var batchId = parseInt(_batchId);

        const batchResponse = await handleRenewBatchOfCertifications(email, batchId, expirationDate);
        if(!batchResponse){
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
        if(!batchStatusResponse){
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError });
        }
        var responseDetails = batchStatusResponse.details ? batchStatusResponse.details : '';
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
    updateBatchStatus

};
