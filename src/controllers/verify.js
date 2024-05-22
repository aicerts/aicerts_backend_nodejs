// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
const fs = require("fs");
const moment = require('moment');
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { validationResult } = require("express-validator");
// Import custom cryptoFunction module for encryption and decryption
const { decryptData } = require("../common/cryptoFunction");

const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;

// Import MongoDB models
const { Issues, BatchIssues } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Importing functions from a custom module
const {
  extractQRCodeDataFromPDF, // Function to extract QR code data from a PDF file
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected, // Function to check if the database connection is established
  insertIssueStatus,
  verificationLogEntry
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

// Retrieve contract address from environment variable
const contractAddress = process.env.CONTRACT_ADDRESS;

// Define an array of providers to use as fallbacks
const providers = [
  new ethers.AlchemyProvider(process.env.RPC_NETWORK, process.env.ALCHEMY_API_KEY),
  new ethers.InfuraProvider(process.env.RPC_NETWORK, process.env.INFURA_API_KEY)
  // Add more providers as needed
];

// Create a new FallbackProvider instance
const fallbackProvider = new ethers.FallbackProvider(providers);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const newContract = new ethers.Contract(contractAddress, abi, signer);

var messageCode = require("../common/codes");
const e = require('express');

/**
 * Verify Certification page with PDF QR - Blockchain URL.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verify = async (req, res) => {
  // Extracting file path from the request
  file = req.file.path;

  var fileBuffer = fs.readFileSync(file);
  var pdfDoc = await PDFDocument.load(fileBuffer);
  // Get today's date
  const getTodayDate = async () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Add leading zero if month is less than 10
    const day = String(today.getDate()).padStart(2, '0'); // Add leading zero if day is less than 10
    const year = today.getFullYear();
    return `${month}/${day}/${year}`;
  };
  const todayDate = await getTodayDate();

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf });
  }

  try {
    // Extract QR code data from the PDF file
    const certificateData = await extractQRCodeDataFromPDF(file);

    if (certificateData === false) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
      return res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotValid });
    }

    var verifyLog = {
      issuerId: "default",
      course: certificateData["Course Name"]
    };

    const certificationNumber = certificateData['Certificate Number'];
    const singleIssueExist = await Issues.findOne({ certificateNumber: certificationNumber });
    const batchIssueExist = await BatchIssues.findOne({ certificateNumber: certificationNumber });

    // Validation checks for request data
    if (singleIssueExist) {
      
      if(singleIssueExist.certificateStatus == 3){
        res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }

      if (certificateData['Expiration Date'] == '1') {

        verifyLog.issuerId = singleIssueExist.issuerId;
        var dbStatus = await isDBConnected();
        if (dbStatus) {
          await verificationLogEntry(verifyLog);
        }

        res.status(200).json({
          status: "SUCCESS",
          message: "Certification is valid",
          details: certificateData
        });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }
      try {
        // Blockchain processing.
        const verifyCert = await newContract.verifyCertificateById(certificationNumber);
        const _certStatus = await newContract.getCertificateStatus(certificationNumber);

        var verifyCertStatus = parseInt(verifyCert[3]);
        var certStatus = parseInt(_certStatus);
        if (certStatus == 3) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }

        if (verifyCert[0] == false && verifyCertStatus == 5) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertExpired });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }

        if (verifyCert[0] == true) {

          const foundCertification = certificateData;

          verifyLog.issuerId = singleIssueExist.issuerId;

          var dbStatus = await isDBConnected();
          if (dbStatus != false) {
            await verificationLogEntry(verifyLog);
          }

          foundCertification['Expiration Date'] = singleIssueExist.expirationDate;

          const verificationResponse = {
            status: "SUCCESS",
            message: "Certification is valid",
            details: foundCertification
          };
          res.status(200).json(verificationResponse);
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        } else if (verifyCert[0] == false) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidCert });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }

      } catch (error) {
        res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }
    } else if (batchIssueExist) {

      if(batchIssueExist.certificateStatus == 3){
        res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }

      if (certificateData['Expiration Date'] == '1') {

        // Add the issuerId parameter
        verifyLog.issuerId = batchIssueExist.issuerId;

        var dbStatus = await isDBConnected();
        if (dbStatus != false) {
          await verificationLogEntry(verifyLog);
        }

        res.status(200).json({
          status: "SUCCESS",
          message: "Certification is valid",
          details: certificateData
        });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }
      if (certificateData['Expiration Date'].length == 10) {
        // Convert data string to a Date object
        const dataDate = new Date(certificateData['Expiration Date']);
        if (dataDate < todayDate) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertExpired });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }
      }
      const batchNumber = (batchIssueExist.batchId) - 1;
      const dataHash = batchIssueExist.certificateHash;
      const proof = batchIssueExist.proofHash;
      const hashProof = batchIssueExist.encodedProof;
      try {
        // Blockchain processing.
        const batchVerifyResponse = await newContract.verifyBatchCertification(batchNumber, dataHash, proof);
        const _responseStatus = await newContract.verifyCertificateInBatch(hashProof);
        var responseStatus = parseInt(_responseStatus);
        if (responseStatus == 3) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }

        if (responseStatus == 5) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertExpired });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }

        if (batchVerifyResponse === true) {

          try {

            var completeResponse = certificateData;

            // Add the issuerId parameter
            verifyLog.issuerId = batchIssueExist.issuerId;

            var dbStatus = await isDBConnected();
            if (dbStatus != false) {
              await verificationLogEntry(verifyLog);
            }

            completeResponse['Expiration Date'] = batchIssueExist.expirationDate;

            const _verificationResponse = {
              status: "SUCCESS",
              message: "Certification is valid",
              details: completeResponse
            };

            res.status(200).json(_verificationResponse);
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
            return;

          } catch (error) {
            res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }
            return;
          }
        } else {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotExist });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }
      } catch (error) {
        res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }

    } else if (!batchIssueExist && !singleIssueExist) {
      if (certificateData['Expiration Date'] == '1') {
        var dbStatus = await isDBConnected();
        if (dbStatus != false) {
          await verificationLogEntry(verifyLog);
        }
        res.status(200).json({
          status: "SUCCESS",
          message: "Certification is valid",
          details: certificateData
        });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }
      // Extract blockchain URL from the certificate data
      const blockchainUrl = certificateData["Polygon URL"];

      var fomatedDate = await detectDateFormat(certificateData['Expiration Date']);

      if (fomatedDate != null) {
        var compareDate = await compareDates(fomatedDate, todayDate);
        if (!compareDate) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertExpired });
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
          return;
        }
      }

      // Check if a blockchain URL exists and is valid
      if (blockchainUrl && blockchainUrl.length > 0) {
        var dbStatus = await isDBConnected();
        if (dbStatus != false) {
          await verificationLogEntry(verifyLog);
        }
        // Respond with success status and certificate details
        res.status(200).json({ status: "SUCCESS", message: messageCode.msgCertValid, Details: certificateData });
        // await cleanUploadFolder();
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      } else {
        // Respond with failure status if no valid blockchain URL is found
        res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotValid });
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
        return;
      }

    } else {
      // Respond with failure status if no valid blockchain URL is found
      res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotValid });
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
      return;
    }

  } catch (error) {
    // If an error occurs during verification, respond with failure status
    const verificationResponse = {
      status: "FAILED",
      message: messageCode.msgCertNotValid
    };

    res.status(400).json(verificationResponse);
    // Clean up the upload folder
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return;
  }

  // Delete the uploaded file after verification
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }

  // Clean up the upload folder
  await cleanUploadFolder();
};

/**
 * Handles the decoding of a certificate from an encrypted link.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const decodeCertificate = async (req, res) => {
  try {
    // Extract encrypted link from the request body
    const encryptedData = req.body.encryptedData;
    const iv = req.body.iv;

    // Decrypt the link
    const decryptedData = decryptData(encryptedData, iv);

    const originalData = JSON.parse(decryptedData);
    let isValid = false;
    let messageContent = "Not Verified"
    let parsedData;
    if (originalData !== null) {
      parsedData = {
        "Certificate Number": originalData.Certificate_Number || "",
        "Course Name": originalData.courseName || "",
        "Expiration Date": originalData.Expiration_Date || "",
        "Grant Date": originalData.Grant_Date || "",
        "Name": originalData.name || "",
        "Polygon URL": originalData.polygonLink || ""
      };

      var verifyLog = {
        issuerId: "default",
        course: parsedData["Course Name"]
      };
      isValid = true
      var dbStatus = await isDBConnected();
      if (dbStatus != false) {
        const singleIssueExist = await Issues.findOne({ certificateNumber: originalData.Certificate_Number });
        const batchIssueExist = await BatchIssues.findOne({ certificateNumber: originalData.Certificate_Number });
        if (originalData.Certificate_Number != "" && (singleIssueExist || batchIssueExist)) {
          if (singleIssueExist) {
            verifyLog.issuerId = singleIssueExist.issuerId;
            parsedData['Expiration Date'] = singleIssueExist.expirationDate;
            var certSingleStatus = singleIssueExist.certificateStatus || 0;
            if ((certSingleStatus != 0) && (certSingleStatus == 3)) {
              isValid = false;
              messageContent = "Certification has Revoked";
            }
          } else if (batchIssueExist) {
            verifyLog.issuerId = batchIssueExist.issuerId;
            parsedData['Expiration Date'] = batchIssueExist.expirationDate;
            var certBatchStatus = batchIssueExist.certificateStatus || 0;
            if ((certBatchStatus != 0) && (certBatchStatus == 3)) {
              isValid = false;
              messageContent = "Certification has Revoked";
            }
          }
        }
      }
    }

    // Respond with the verification status and decrypted data if valid
    if (isValid) {
      if (dbStatus) {
        await verificationLogEntry(verifyLog);
      }
      res.status(200).json({ status: "PASSED", message: "Verified", data: parsedData });
    } else {
      res.status(200).json({ status: "FAILED", message: messageContent });
    }
  } catch (error) {
    // Handle errors and send an appropriate response
    console.error(error);
    res.status(500).json({ message: messageCode.msgInternalError });
  }
};

/**
 * API call for Single / Batch Certificates verify with Certification ID.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyCertificationId = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  const inputId = req.body.id;
  // Get today's date
  const getTodayDate = async () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Add leading zero if month is less than 10
    const day = String(today.getDate()).padStart(2, '0'); // Add leading zero if day is less than 10
    const year = today.getFullYear();
    return `${month}/${day}/${year}`;
  };
  try {
    var dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);

    const singleIssueExist = await Issues.findOne({ certificateNumber: inputId });
    const batchIssueExist = await BatchIssues.findOne({ certificateNumber: inputId });

    // Validation checks for request data
    if (!batchIssueExist && !singleIssueExist) {
      // Respond with error message
      return res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotValid });
    }

    if (singleIssueExist) {

      var verifyLog = {
        issuerId: singleIssueExist.issuerId,
        course: singleIssueExist.course
      };

      if(singleIssueExist.certificateStatus == 3){
        return res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
      }

      if (singleIssueExist.expirationDate == '1') {
        var _polygonLink = `https://${process.env.NETWORK}/tx/${singleIssueExist.transactionHash}`;

        var completeResponse = {
          'Certificate Number': singleIssueExist.certificateNumber,
          'Name': singleIssueExist.name,
          'Course Name': singleIssueExist.course,
          'Grant Date': singleIssueExist.grantDate,
          'Expiration Date': singleIssueExist.expirationDate,
          'Polygon URL': _polygonLink
        };

        if (dbStatus) {
          await verificationLogEntry(verifyLog);
        }

        res.status(200).json({
          status: "SUCCESS",
          message: "Certification is valid",
          details: completeResponse
        });
        return;
      }
      try {
        // Blockchain processing.
        const verifyCert = await newContract.verifyCertificateById(inputId);
        const _certStatus = await newContract.getCertificateStatus(inputId);

        var verifyCertStatus = parseInt(verifyCert[3]);
        var certStatus = parseInt(_certStatus);
        if (certStatus == 3) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
        }

        if (verifyCert[0] == false && verifyCertStatus == 5) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgCertExpired });
        }

        if (verifyCert[0] == true) {

          var _polygonLink = `https://${process.env.NETWORK}/tx/${singleIssueExist.transactionHash}`;

          var completeResponse = {
            'Certificate Number': singleIssueExist.certificateNumber,
            'Name': singleIssueExist.name,
            'Course Name': singleIssueExist.course,
            'Grant Date': singleIssueExist.grantDate,
            'Expiration Date': singleIssueExist.expirationDate,
            'Polygon URL': _polygonLink
          };

          const foundCertification = (singleIssueExist != null) ? completeResponse : inputId;

          if (dbStatus) {
            await verificationLogEntry(verifyLog);
          }

          const verificationResponse = {
            status: "SUCCESS",
            message: "Certification is valid",
            details: foundCertification
          };
          return res.status(200).json(verificationResponse);
        } else if (verifyCert[0] == false) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidCert });
        }

      } catch (error) {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }

    } else if (batchIssueExist) {

      var verifyLog = {
        issuerId: batchIssueExist.issuerId,
        course: batchIssueExist.course
      };

      if(batchIssueExist.certificateStatus == 3){
        return res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
      }

      if (batchIssueExist.expirationDate == '1') {
        var _polygonLink = `https://${process.env.NETWORK}/tx/${batchIssueExist.transactionHash}`;

        var completeResponse = {
          'Certificate Number': batchIssueExist.certificateNumber,
          'Name': batchIssueExist.name,
          'Course Name': batchIssueExist.course,
          'Grant Date': batchIssueExist.grantDate,
          'Expiration Date': batchIssueExist.expirationDate,
          'Polygon URL': _polygonLink
        };

        if (dbStatus) {
          await verificationLogEntry(verifyLog);
        }

        res.status(200).json({
          status: "SUCCESS",
          message: "Certification is valid",
          details: completeResponse
        });
        return;
      }
      if ((batchIssueExist.expirationDate).length == 10) {
        var dateToday = await getTodayDate();
        var expirationDate = batchIssueExist.expirationDate;
        var compareResult = await compareDates(expirationDate, dateToday);
        if (!compareResult) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgCertExpired });
          return;
        }
      }
      const batchNumber = (batchIssueExist.batchId) - 1;
      const dataHash = batchIssueExist.certificateHash;
      const proof = batchIssueExist.proofHash;
      const hashProof = batchIssueExist.encodedProof;
      try {
        // Blockchain processing.
        const batchVerifyResponse = await newContract.verifyBatchCertification(batchNumber, dataHash, proof);
        const _responseStatus = await newContract.verifyCertificateInBatch(hashProof);
        var responseStatus = parseInt(_responseStatus);
        if (responseStatus == 3) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgCertRevoked });
        }

        if (responseStatus == 5) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgCertExpired });
        }

        if (batchVerifyResponse === true) {

          try {

            var _polygonLink = `https://${process.env.NETWORK}/tx/${batchIssueExist.transactionHash}`;

            var completeResponse = {
              'Certificate Number': batchIssueExist.certificateNumber,
              'Name': batchIssueExist.name,
              'Course Name': batchIssueExist.course,
              'Grant Date': batchIssueExist.grantDate,
              'Expiration Date': batchIssueExist.expirationDate,
              'Polygon URL': _polygonLink
            };

            if (dbStatus) {
              await verificationLogEntry(verifyLog);
            }

            const _verificationResponse = {
              status: "SUCCESS",
              message: "Certification is valid",
              details: completeResponse
            };

            res.status(200).json(_verificationResponse);

          } catch (error) {
            return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
          }
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgCertNotExist });
        }
      } catch (error) {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

const detectDateFormat = async (dateString) => {
  const formats = ['DD MMMM YYYY', 'MMMM DD YYYY', 'MM/DD/YY', 'MM/DD/YYYY'];

  for (let format of formats) {
    const parsedDate = moment(dateString, format, true);
    if (parsedDate.isValid()) {
      // Convert to MM/DD/YYYY format
      const convertedDate = parsedDate.format('MM/DD/YYYY');
      return convertedDate;
    }
  }
  return null;
};

const compareDates = async (dateString1, dateString2) => {
  // Split the date strings into components
  const [month1, day1, year1] = dateString1.split('/');
  const [month2, day2, year2] = dateString2.split('/');

  // Create date objects for comparison
  const date1 = new Date(year1, month1 - 1, day1);
  const date2 = new Date(year2, month2 - 1, day2);

  if (date1 > date2) {
    return true;
  } else if (date1 == date2) {
    return true;
  } else {
    return false;
  }
};

module.exports = {
  // Function to verify a certificate with a PDF QR code
  verify,

  // Function to verify a Single/Batch certification with an ID
  verifyCertificationId,

  // Function to decode a certificate
  decodeCertificate
};
