// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const QRCode = require("qrcode");
const path = require("path"); // Module for working with file paths
const fs = require("fs");
const _fs = require("fs-extra");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const keccak256 = require('keccak256');
const { validationResult } = require("express-validator");
const archiver = require('archiver');
const unzipper = require('unzipper');

const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../common/cryptoFunction");

const AWS = require('../config/aws-config');

// Import MongoDB models
const { User, Issues, BatchIssues, DynamicParameters } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

const extractionPath = './uploads';

const bulkIssueStatus = process.env.BULK_ISSUE_STATUS || 'DEFAULT';
const cloudStore = process.env.CLOUD_STORE || 'DEFAULT';

const destDirectory = path.join(__dirname, '../../uploads/completed');
const uploadPath = path.join(__dirname, '../../uploads');

// Importing functions from a custom module
const {
  convertDateFormat,
  convertDateToEpoch,
  insertBatchCertificateData, // Function to insert Batch certificate data into the database
  calculateHash, // Function to calculate the hash of a file
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected, // Function to check if the database connection is established
  insertUrlData,
  flushUploadFolder,
  wipeUploadFolder,
  getIssuerServiceCredits,
  updateIssuerServiceCredits,
  validatePDFDimensions,
  verifyBulkDynamicPDFDimensions
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { handleExcelFile, handleBulkExcelFile } = require('../services/handleExcel');
const { handleIssueCertification, handleIssuePdfCertification, handleIssueDynamicPdfCertification, dynamicBatchCertificates, handleIssuance } = require('../services/issue');

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
// const fallbackProvider = new ethers.FallbackProvider([rpcProvider]);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const newContract = new ethers.Contract(contractAddress, abi, signer);

const messageCode = require("../common/codes");

// const currentDir = __dirname;
// const parentDir = path.dirname(path.dirname(currentDir));
const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // File type

const decodeKey = process.env.AUTH_KEY || 0;
var existIssuerId;

/**
 * API call for Certificate issue with pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issuePdf = async (req, res) => {
  if (!req.file.path) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMustPdf });
  }

  var file = req?.file;
  const fileBuffer = fs.readFileSync(req.file.path);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  let _expirationDate;

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    // await cleanUploadFolder();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    const _grantDate = await convertDateFormat(req.body.grantDate);

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await User.findOne({ email: email });
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    if (_grantDate == "1" || _grantDate == null || _grantDate == "string") {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
      return;
    }
    if (req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
      _expirationDate = 1;
    } else {
      _expirationDate = await convertDateFormat(req.body.expirationDate);
    }

    if (_expirationDate == null) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
      return;
    }

    const issueResponse = await handleIssuePdfCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate, req.file.path);
    const responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');

      // Set response headers for PDF to download
      const certificateName = `${certificateNumber}_certificate.pdf`;

      res.set({
        'Content-Type': "application/pdf",
        'Content-Disposition': `attachment; filename="${certificateName}"`, // Change filename as needed
      });

      // Send Pdf file
      res.send(issueResponse.file);
      return;

    } else {
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
    }

  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Certificate issue with dynamic QR on the pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issueDynamicPdf = async (req, res) => {
  if (!req.file.path) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMustPdf });
  }

  var file = req?.file;
  const fileBuffer = fs.readFileSync(req.file.path);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  let _expirationDate;

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    // await cleanUploadFolder();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf });
  }
  try {

    // Extracting required data from the request body
    let email = req.body.email;
    let certificateNumber = req.body.certificateNumber;
    let certificateName = req.body.name;
    let customFields = req.body.customFields;
    let positionX = req.body.posx;
    let positionY = req.body.posy;
    let qrsize = req.body.qrsize;
    let _positionX = parseInt(positionX);
    let _positionY = parseInt(positionY);
    let _qrsize = parseInt(qrsize);

    if (!email || !certificateNumber || !certificateName || !_positionX || !_positionY || !_qrsize || !customFields) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputProvide });
      return;
    }

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await User.findOne({ email: email });
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    const issueResponse = await handleIssueDynamicPdfCertification(email, certificateNumber, certificateName, customFields, req.file.path, _positionX, _positionY, _qrsize);
    const responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');

      // Set response headers for PDF to download
      const certificateName = `${certificateNumber}_certificate.pdf`;

      res.set({
        'Content-Type': "application/pdf",
        'Content-Disposition': `attachment; filename="${certificateName}"`, // Change filename as needed
      });

      // Send Pdf file
      res.send(issueResponse.file);
      return;

    } else {
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
    }

  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Certificate issue without pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issue = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    const _grantDate = await convertDateFormat(req.body.grantDate);
    let _expirationDate;
    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await User.findOne({ email: email });
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    if (_grantDate == "1" || _grantDate == null || _grantDate == "string") {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
      return;
    }
    if (req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
      _expirationDate = 1;
    } else {
      _expirationDate = await convertDateFormat(req.body.expirationDate);
    }

    if (_expirationDate == null) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
      return;
    }

    const issueResponse = await handleIssueCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate);
    const responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {

      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');

      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, qrCodeImage: issueResponse.qrCodeImage, polygonLink: issueResponse.polygonLink, details: responseDetails });
    }

    res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};

/**
 * API call for Certificate custom issue without pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const Issuance = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  try {
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    const flag = req.body.flag || false;
    var _grantDate = req.body.grantDate;
    var _expirationDate;

    // Validate Expiration date
    if (req.body.expirationDate == "" || req.body.expirationDate == "1" || req.body.expirationDate == 1 || req.body.expirationDate == null || req.body.expirationDate == "string") {
      _expirationDate = 1;
    } else {
      _expirationDate = req.body.expirationDate;
    }
    if (!_expirationDate) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExpirationDate, details: req.body.expirationDate });
    }

    if (_grantDate == "" || _grantDate == "1" || _grantDate == 1 || _grantDate == null || _grantDate == "string") {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
    }
    var _grantDate = await convertDateFormat(req.body.grantDate);
    if (!_grantDate) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidGrantDate, details: req.body.grantDate });
    }
    console.log("Request Enduser name: ", name);
    const issueResponse = await handleIssuance(email, certificateNumber, name, courseName, _grantDate, _expirationDate, flag);
    var responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {
      return res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, qrCodeImage: issueResponse.qrCodeImage, polygonLink: issueResponse.polygonLink, details: responseDetails });
    }

    res.status(issueResponse.code).json({ status: issueResponse.status, message: issueResponse.message, details: responseDetails });
  } catch (error) {
    // Handle any errors that occur during token verification or validation
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError });
  }
};


/**
 * API call for Batch Certificates issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const batchIssueCertificate = async (req, res) => {
  const email = req.body.email;
  var file = req?.file;
  // Check if the file path matches the pattern
  if (req.file.mimetype != fileType) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustExcel;
    // await cleanUploadFolder();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    res.status(400).json({ status: "FAILED", message: errorMessage });
    return;
  }

  // Verify with existing credits limit of an issuer to perform the operation
  if (email) {
    let dbStatus = await isDBConnected();
    if (dbStatus) {
      var issuerExist = await User.findOne({ email: email });
      if (issuerExist && issuerExist.issuerId) {
        existIssuerId = issuerExist.issuerId;
        let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
        if (fetchCredits === true) {
          return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
        }
        if (fetchCredits) {
        } else {
          return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
        }
      } else {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
      }
    }
  }

  try {
    await isDBConnected();
    const idExist = issuerExist;
    let filePath = req.file.path;

    // Fetch the records from the Excel file
    const excelData = await handleExcelFile(filePath);
    await _fs.remove(filePath);

    try {

      if (
        (!idExist || idExist.status !== 1) || // User does not exist
        // !idExist || 
        !req.file.filename ||
        req.file.filename === 'undefined' ||
        excelData.response === false) {

        let errorMessage = messageCode.msgPlsEnterValid;
        let _details = excelData.Details;
        if (!idExist) {
          errorMessage = messageCode.msgInvalidIssuer;
          _details = idExist.email;
        }
        else if (!excelData.response) {
          errorMessage = excelData.message;
        } else if (idExist.status !== 1) {
          errorMessage = messageCode.msgUnauthIssuer;
        }

        res.status(400).json({ status: "FAILED", message: errorMessage, details: _details });
        return;

      } else {

        // Batch Certification Formated Details
        const rawBatchData = excelData.message[0];
        // Certification count
        const certificatesCount = excelData.message[1];
        // certification unformated details
        const batchData = excelData.message[2];

        // Extracting only expirationDate values
        const expirationDates = rawBatchData.map(item => item.expirationDate);
        const firstItem = expirationDates[0];
        const firstItemEpoch = await convertDateToEpoch(firstItem);
        const allDatesCommon = expirationDates.every(date => date === firstItem);

        const certificationIDs = rawBatchData.map(item => item.certificationID);

        // Assuming BatchIssues is your MongoDB model
        for (const id of certificationIDs) {
          const issueExist = await Issues.findOne({ certificateNumber: id });
          const _issueExist = await BatchIssues.findOne({ certificateNumber: id });
          if (issueExist || _issueExist) {
            matchingIDs.push(id);
          }
        }

        const updatedBatchData = batchData.map(data => {
          return data.map(item => {
            return item === null ? '1' : item;
          });
        });

        const hashedBatchData = updatedBatchData.map(data => {
          // Convert data to string and calculate hash
          const dataString = data.map(item => item.toString()).join('');
          const _hash = calculateHash(dataString);
          return _hash;
        });

        // // Format as arrays with corresponding elements using a loop
        const values = [];
        for (let i = 0; i < certificatesCount; i++) {
          values.push([hashedBatchData[i]]);
        }

        try {
          // Verify on blockchain
          const isPaused = await newContract.paused();
          // Check if the Issuer wallet address is a valid Ethereum address
          if (!ethers.isAddress(idExist.issuerId)) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
          }
          const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);

          if (isPaused === true || issuerAuthorized === false) {
            // Certificate contract paused
            let messageContent = messageCode.msgOpsRestricted;

            if (issuerAuthorized === flase) {
              messageContent = messageCode.msgIssuerUnauthrized;
            }

            return res.status(400).json({ status: "FAILED", message: messageContent });
          }

          // Generate the Merkle tree
          const tree = StandardMerkleTree.of(values, ['string']);
          let dateEntry;

          const batchNumber = await newContract.getRootLength();
          const allocateBatchId = parseInt(batchNumber) + 1;
          // const allocateBatchId = 1;
          if (allDatesCommon) {
            dateEntry = firstItemEpoch;
          } else {
            dateEntry = 0;
          }

          let { txHash, polygonLink } = await issueBatchCertificateWithRetry(tree.root, dateEntry);
          if (!polygonLink || !txHash) {
            return ({ code: 400, status: false, message: messageCode.msgFaileToIssueAfterRetry, details: certificateNumber });
          }

          try {
            // Check mongoose connection
            const dbStatus = await isDBConnected();
            const dbStatusMessage = (dbStatus) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
            console.log(dbStatusMessage);

            let batchDetails = [];
            var batchDetailsWithQR = [];
            let insertPromises = []; // Array to hold all insert promises

            for (let i = 0; i < certificatesCount; i++) {
              let _proof = tree.getProof(i);
              // console.log("The hash", _proof);
              // Convert each hexadecimal string to a Buffer
              let buffers = _proof.map(hex => Buffer.from(hex.slice(2), 'hex'));
              // Concatenate all Buffers into one
              let concatenatedBuffer = Buffer.concat(buffers);
              // Calculate SHA-256 hash of the concatenated buffer
              let _proofHash = crypto.createHash('sha256').update(concatenatedBuffer).digest('hex');
              let _grantDate = await convertDateFormat(rawBatchData[i].grantDate);
              let _expirationDate = (rawBatchData[i].expirationDate == "1" || rawBatchData[i].expirationDate == null) ? "1" : rawBatchData[i].expirationDate;
              batchDetails[i] = {
                issuerId: idExist.issuerId,
                batchId: allocateBatchId,
                proofHash: _proof,
                encodedProof: `0x${_proofHash}`,
                transactionHash: txHash,
                certificateHash: hashedBatchData[i],
                certificateNumber: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                course: rawBatchData[i].certificationName,
                grantDate: _grantDate,
                expirationDate: _expirationDate,
                email: email,
                certStatus: 1
              }

              let _fields = {
                Certificate_Number: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                courseName: rawBatchData[i].certificationName,
                Grant_Date: _grantDate,
                Expiration_Date: _expirationDate,
                polygonLink
              }

              let encryptLink = await generateEncryptedUrl(_fields);
              let shortUrlStatus = false;
              let modifiedUrl = false;

              if (encryptLink) {
                let _dbStatus = await isDBConnected();
                if (_dbStatus) {
                  let urlData = {
                    email: email,
                    certificateNumber: rawBatchData[i].certificationID,
                    url: encryptLink
                  }
                  await insertUrlData(urlData);
                  shortUrlStatus = true;
                }
              }

              if (shortUrlStatus) {
                modifiedUrl = process.env.SHORT_URL + rawBatchData[i].certificationID;
              }

              let _qrCodeData = modifiedUrl !== false ? modifiedUrl : encryptLink;

              let qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
                errorCorrectionLevel: "H",
                width: 450, // Adjust the width as needed
                height: 450, // Adjust the height as needed
              });

              batchDetailsWithQR[i] = {
                issuerId: idExist.issuerId,
                batchId: allocateBatchId,
                transactionHash: txHash,
                certificateHash: hashedBatchData[i],
                certificateNumber: rawBatchData[i].certificationID,
                name: rawBatchData[i].name,
                course: rawBatchData[i].certificationName,
                grantDate: _grantDate,
                expirationDate: _expirationDate,
                qrImage: qrCodeImage
              }

              insertPromises.push(insertBatchCertificateData(batchDetails[i]));
            }
            // Wait for all insert promises to resolve
            await Promise.all(insertPromises);
            let newCount = certificatesCount;
            let oldCount = idExist.certificatesIssued;
            idExist.certificatesIssued = newCount + oldCount;
            await idExist.save();

            // Update Issuer credits limit (decrease by 1)
            await updateIssuerServiceCredits(existIssuerId, 'issue');

            res.status(200).json({
              status: "SUCCESS",
              message: messageCode.msgBatchIssuedSuccess,
              polygonLink: polygonLink,
              details: batchDetailsWithQR,
            });

            // await cleanUploadFolder();
            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }

          } catch (error) {
            // Handle mongoose connection error (log it, response an error, etc.)
            console.error(messageCode.msgInternalError, error);
            return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
          }

        } catch (error) {
          console.error('Error:', error);
          return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidExcel, details: error });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API call for Bulk Certificate issue (batch) with pdf templates.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const dynamicBatchIssueCertificates = async (req, res) => {
  var file = req?.file;
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ status: "FAILED", message: errorMessage });
    // await cleanUploadFolder();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];
  var certsExist = [];
  var existIssuerId;


  var today = new Date();
  var options = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'America/New_York' // Set the timezone to US Eastern Time
  };

  var formattedDateTime = today.toLocaleString('en-US', options).replace(/\//g, '-').replace(/,/g, '-').replace(/:/g, '-').replace(/\s/g, '');

  const resultDierectory = path.join(__dirname, '../../uploads/completed');

  try {
    await isDBConnected();

    var filePath = req.file.path;
    const email = req.body.email;
    const flag = parseInt(req.body.flag);

    // Verify with existing credits limit of an issuer to perform the operation
    if (email) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        var issuerExist = await User.findOne({ email: email });
        if (issuerExist && issuerExist.issuerId) {
          existIssuerId = issuerExist.issuerId;
          let fetchCredits = await getIssuerServiceCredits(existIssuerId, 'issue');
          if (fetchCredits === true) {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaStatus });
          }
          if (fetchCredits) {
          } else {
            return res.status(503).json({ status: "FAILED", message: messageCode.msgIssuerQuotaExceeded });
          }
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuerId });
        }
      }
    }

    const emailExist = await User.findOne({ email: email });
    const paramsExist = await DynamicParameters.findOne({ email: email });

    if (!emailExist || !paramsExist) {
      var messageContent = messageCode.msgInvalidEmail;
      if (!paramsExist) {
        messageContent = messageCode.msgInvalidParams;
      }
      res.status(400).json({ status: "FAILED", message: messageContent, details: email });
      return;
    }

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }
    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);

    if (fs.existsSync(destDirectory)) {
      // Delete the existing directory recursively
      fs.rmSync(destDirectory, { recursive: true });
    }
    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: extractionPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });
    filesList = await fs.promises.readdir(extractionPath);

    let zipExist = await findDirectories(filesList);
    if (zipExist) {
      filesList = zipExist;
    }

    if (filesList.length == 0 || filesList.length == 1) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindExcelFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    const excelFilePath = path.join(__dirname, '../../uploads', xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    const excelData = await handleBulkExcelFile(excelFilePath);
    // await _fs.remove(filePath);
    if (excelData.response == false) {
      var errorDetails = (excelData.Details).length > 0 ? excelData.Details : "";
      res.status(400).json({ status: "FAILED", message: excelData.message, details: errorDetails });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.Certs + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedCerts = pdfFiles.filter(cert => certsWithPDF.includes(cert));
    //Exctract only cert Ids
    const certsIds = excelDataResponse.map(item => item.certificationID);
    for (let index = 0; index < certsIds.length; index++) {
      let targetId = certsIds[index];
      let val = await newContract.verifyCertificateById(targetId);
      if (val[0] == true) {
        certsExist.push(targetId);
      }
    }
    if (certsExist.length > 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgExcelHasExistingIds, details: certsExist });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    if ((pdfFiles.length != matchedCerts.length) || (matchedCerts.length != excelData.message[1])) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var pdfPagesValidation = [];
    var pdfTemplateValidation = [];
    for (let index = 0; index < pdfFiles.length; index++) {
      try {
        console.log("Processing file index:", index);
        let targetDocument = pdfFiles[index];

        // Construct the PDF file path
        let pdfFilePath = path.join(__dirname, '../../uploads', targetDocument);

        let templateBuffer = fs.readFileSync(pdfFilePath);
        let pdfDoc = await PDFDocument.load(templateBuffer);
        let pageCount = pdfDoc.getPageCount();
        if (pageCount > 1) {
          pdfPagesValidation.push(targetDocument);
        }

        // Validate PDF dimensions
        let validityCheck = await validatePDFDimensions(pdfFilePath, paramsExist.pdfWidth, paramsExist.pdfHeight);

        // Push invalid PDFs to the array
        if (validityCheck === false) {
          pdfTemplateValidation.push(targetDocument); // Use targetDocument instead of pdfFiles[index]
        }
      } catch (error) {
        console.error("Error processing file:", pdfFiles[index], error);
      }
    }

    if (pdfTemplateValidation.length > 0 || pdfPagesValidation.length > 0) {
      let errorMessage = '';
      let errorDetails = '';
      if (pdfPagesValidation.length > 0) {
        errorMessage = messageCode.msgMultipagePdfError;
        errorDetails = pdfPagesValidation;
      } else {
        errorMessage = messageCode.msgInvalidPdfDimensions;
        errorDetails = pdfTemplateValidation;
      }
      res.status(400).json({ status: "FAILED", message: errorMessage, details: errorDetails });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var bulkIssueResponse = await dynamicBatchCertificates(emailExist.email, emailExist.issuerId, pdfFiles, excelData.message, excelFilePath, paramsExist.positionX, paramsExist.positionY, paramsExist.qrSide, paramsExist.pdfWidth, paramsExist.pdfHeight, flag);

    if (bulkIssueStatus == 'ZIP_STORE' || flag == 1) {
      if (bulkIssueResponse.code == 200) {
        // Update Issuer credits limit (decrease by 1)
        await updateIssuerServiceCredits(existIssuerId, 'issue');

        const zipFileName = `${formattedDateTime}.zip`;
        const resultFilePath = path.join(__dirname, '../../uploads', zipFileName);

        // Create a new zip archive
        const archive = archiver('zip', {
          zlib: { level: 9 } // Sets the compression level
        });

        // Create a write stream for the zip file
        const output = fs.createWriteStream(resultFilePath);
        if (cloudStore == 'S3_STORE') {
          var fetchResultZipFile = path.basename(resultFilePath);
        }

        // Listen for close event of the archive
        output.on('close', async () => {
          console.log(archive.pointer() + ' total bytes');
          if (cloudStore == 'S3_STORE') {
            const fileBackup = await backupFileToCloud(fetchResultZipFile, resultFilePath, 2);
            if (fileBackup.response == false) {
              console.log("The S3 backup failed", fileBackup.details);
            }
          }
          console.log('Zip file created successfully');
          if (fs.existsSync(destDirectory)) {
            // Delete the existing directory recursively
            fs.rmSync(destDirectory, { recursive: true });
          }
          // Send the zip file as a download
          res.download(resultFilePath, zipFileName, (err) => {
            if (err) {
              console.error('Error downloading zip file:', err);
            }
            // Delete the zip file after download
            // fs.unlinkSync(resultFilePath);
            fs.unlinkSync(resultFilePath, (err) => {
              if (err) {
                console.error('Error deleting zip file:', err);
              }
              console.log('Zip file deleted');
            });
          });
        });

        // Pipe the output stream to the zip archive
        archive.pipe(output);
        var excelFileName = path.basename(excelFilePath);
        // Append the file to the list
        pdfFiles.push(excelFileName);

        // Add PDF files to the zip archive
        pdfFiles.forEach(file => {
          const filePath = path.join(destDirectory, file);
          archive.file(filePath, { name: file });
        });

        // Finalize the zip archive
        archive.finalize();

        // Always delete the excel files (if it exists)
        if (fs.existsSync(excelFilePath)) {
          fs.unlinkSync(excelFilePath);
        }
        let uploadPath = path.join(__dirname, '../../uploads');
        let files = fs.readdirSync(uploadPath);
        console.log("Files remain", files);
        await flushUploadFolder();
        return;
      } else {
        var statusCode = bulkIssueResponse.code || 400;
        var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
        var statusDetails = bulkIssueResponse.Details || "";
        res.status(statusCode).json({ status: "FAILED", message: statusMessage, details: statusDetails });
        await wipeUploadFolder();
        // await flushUploadFolder();
        return;
      }
    }

    if (bulkIssueResponse.code == 200) {
      // Update Issuer credits limit (decrease by 1)
      await updateIssuerServiceCredits(existIssuerId, 'issue');
      let bulkResponse = {
        email: emailExist.email,
        issuerId: emailExist.issuerId,
        height: paramsExist.pdfHeight,
        width: paramsExist.pdfWidth,
        urls: bulkIssueResponse.Details
      }
      res.status(bulkIssueResponse.code).json({ status: "SUCCESS", message: messageCode.msgBatchIssuedSuccess, details: bulkResponse });
      await cleanUploadFolder();
      // await flushUploadFolder();
      return;
    } else {
      var statusCode = bulkIssueResponse.code || 400;
      var statusMessage = bulkIssueResponse.message || messageCode.msgFailedToIssueBulkCerts;
      var statusDetails = bulkIssueResponse.Details || "";
      res.status(statusCode).json({ status: "FAILED", message: statusMessage, details: statusDetails });
      await wipeUploadFolder();
      // await flushUploadFolder();
      return;
    }

  } catch (error) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
    return;
  }
};

/**
 * API call for store dynamic QR poisioning parameters for the Dynamic Bulk Issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const acceptDynamicInputs = async (req, res) => {
  var file = req?.file;
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.pdf')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustPdf;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    // await cleanUploadFolder();
    res.status(400).json({ status: "FAILED", message: errorMessage, details: req.file });
    return;
  }

  // Extracting file path from the request
  file = req.file.path;
  const email = req.body.email;
  const positionx = parseInt(req.body.posx);
  const positiony = parseInt(req.body.posy);
  const qrSide = parseInt(req.body.qrside);

  if (!email || !positionx || !positiony || !qrSide) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidInput, details: email });
    return;
  }

  var isIssuerExist = await User.findOne({ email: email });
  if (!isIssuerExist) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuer, details: email });
    return;
  }

  const pdfResponse = await verifyBulkDynamicPDFDimensions(file, positionx, positiony, qrSide);

  if (pdfResponse.status == false || pdfResponse.morePages == 1) {
    var messageContent = messageCode.msgInvalidPdfTemplate;
    if (pdfResponse.morePages == 1) {
      messageContent = messageCode.msgMultiPagePdf
    }
    // await cleanUploadFolder();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    res.status(400).json({ status: "FAILED", message: messageContent, details: email });
    return;
  }

  const pdfWidth = pdfResponse.width;
  const pdfHeight = pdfResponse.height;
  try {
    var dbStatus = isDBConnected();
    if (dbStatus) {
      const isParamsExist = await DynamicParameters.findOne({ email: email });
      if (!isParamsExist) {
        let newDynamicParams = new DynamicParameters({
          email: email,
          positionX: positionx,
          positionY: positiony,
          qrSide: qrSide,
          pdfHeight: pdfHeight,
          pdfWidth: pdfWidth,
          paramStatus: true,
          issueDate: Date.now() // Set the issue date to the current timestamp
        });
        // Save the new Issues document to the database
        await newDynamicParams.save();
      } else {
        isParamsExist.positionX = positionx;
        isParamsExist.positionY = positiony;
        isParamsExist.qrSide = qrSide;
        isParamsExist.pdfHeight = pdfHeight;
        isParamsExist.pdfWidth = pdfWidth;
        isParamsExist.paramStatus = true;
        isParamsExist.issueDate = Date.now();
        await isParamsExist.save();

      }
      // await cleanUploadFolder();
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
      res.status(200).json({ status: "SUCCESS", message: messageCode.msgUnderConstruction, details: isParamsExist });
      return;
    }
  } catch (error) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgDbNotReady, details: error });
    return;
  }
};

/**
 * API call for validate Certificates (zip) for dynamic QR poisioning.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const validateDynamicBulkIssueDocuments = async (req, res) => {
  var file = req?.file;
  // Check if the file path matches the pattern
  if (!req.file || !req.file.originalname.endsWith('.zip')) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustZip;
    res.status(400).json({ status: "FAILED", message: errorMessage });
    // await cleanUploadFolder();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    return;
  }

  var filesList = [];
  // Initialize an empty array to store the file(s) ending with ".xlsx"
  var xlsxFiles = [];
  // Initialize an empty array to store the file(s) ending with ".pdf"
  var pdfFiles = [];

  var certsExist = [];

  try {
    await isDBConnected();

    var filePath = req.file.path;
    const email = req.body.email;

    const emailExist = await User.findOne({ email: email });
    const paramsExist = await DynamicParameters.findOne({ email: email });

    if (!emailExist || !paramsExist) {
      var messageContent = messageCode.msgInvalidEmail;
      if (!paramsExist) {
        messageContent = messageCode.msgInvalidParams;
      }
      res.status(400).json({ status: "FAILED", message: messageContent, details: email });
      return;
    }

    // Function to check if a file is empty
    const stats = fs.statSync(filePath);
    var zipFileSize = parseInt(stats.size);
    if (zipFileSize <= 100) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // if (fs.existsSync(file)) {
      //   fs.unlinkSync(file);
      // }
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(filePath);

    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
      readStream.pipe(unzipper.Extract({ path: extractionPath }))
        .on('error', err => {
          console.error('Error extracting zip file:', err);
          res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles, details: err });
          reject(err);
        })
        .on('finish', () => {
          console.log('Zip file extracted successfully.');
          resolve();
        });
    });

    filesList = await fs.promises.readdir(extractionPath);

    let zipExist = await findDirectories(filesList);
    if (zipExist) {
      filesList = zipExist;
    }
    // return res.status(200).json({ status: "FAILED", message: messageCode.msgWorkInProgress });
    if (filesList.length == 0 || filesList.length == 1) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.xlsx')) {
        xlsxFiles.push(file);
      }
    });

    if (xlsxFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindExcelFiles });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    filesList.forEach(file => {
      if (file.endsWith('.pdf')) {
        pdfFiles.push(file);
      }
    });

    if (pdfFiles.length == 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgUnableToFindPdfFiles });
      await cleanUploadFolder();
      return;
    }

    const excelFilePath = path.join('./uploads', xlsxFiles[0]);

    // console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    // Fetch the records from the Excel file
    const excelData = await handleBulkExcelFile(excelFilePath);
    // await _fs.remove(filePath);

    if (excelData.response == false) {
      var errorDetails = (excelData.Details).length > 0 ? excelData.Details : "";
      res.status(400).json({ status: "FAILED", message: excelData.message, details: errorDetails });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var excelDataResponse = excelData.message[0];

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelDataResponse.map(item => item.Certs + ".pdf");
    // Compare certsWithPDF with data in Excel
    const matchedCerts = pdfFiles.filter(cert => certsWithPDF.includes(cert));
    //Exctract only cert Ids
    const certsIds = excelDataResponse.map(item => item.certificationID);
    for (let index = 0; index < certsIds.length; index++) {
      let targetId = certsIds[index];
      let val = await newContract.verifyCertificateById(targetId);
      if (val[0] == true) {
        certsExist.push(targetId);
      }
    }
    if (certsExist.length > 0) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgExcelHasExistingIds, details: certsExist });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    if ((pdfFiles.length != matchedCerts.length) || (matchedCerts.length != excelData.message[1])) {
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputRecordsNotMatched });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    var pdfPagesValidation = [];
    var pdfTemplateValidation = [];
    for (let index = 0; index < pdfFiles.length; index++) {
      try {
        // console.log("Processing file index:", index);
        let targetDocument = pdfFiles[index];

        // Construct the PDF file path
        let pdfFilePath = path.join(__dirname, '../../uploads', targetDocument);

        let templateBuffer = fs.readFileSync(pdfFilePath);
        let pdfDoc = await PDFDocument.load(templateBuffer);
        let pageCount = pdfDoc.getPageCount();
        if (pageCount > 1) {
          pdfPagesValidation.push(targetDocument);
        }

        // Validate PDF dimensions
        let validityCheck = await validatePDFDimensions(pdfFilePath, paramsExist.pdfWidth, paramsExist.pdfHeight);

        // Push invalid PDFs to the array
        if (validityCheck === false) {
          pdfTemplateValidation.push(targetDocument); // Use targetDocument instead of pdfFiles[index]
        }
      } catch (error) {
        console.error("Error processing file:", pdfFiles[index], error);
      }
    }

    if (pdfTemplateValidation.length > 0 || pdfPagesValidation.length > 0) {
      let errorMessage = '';
      let errorDetails = '';
      if (pdfPagesValidation.length > 0) {
        errorMessage = messageCode.msgMultipagePdfError;
        errorDetails = pdfPagesValidation;
      } else {
        errorMessage = messageCode.msgInvalidPdfDimensions;
        errorDetails = pdfTemplateValidation;
      }
      res.status(400).json({ status: "FAILED", message: errorMessage, details: errorDetails });
      // await cleanUploadFolder();
      await wipeUploadFolder();
      return;
    }

    res.status(200).json({ status: "SUCCESS", message: messageCode.msgValidDocumentsUploaded, details: email });
    await wipeUploadFolder();
    return;

  } catch (error) {
    res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
    await wipeUploadFolder();
    return;
  }

};

const issueBatchCertificateWithRetry = async (root, expirationEpoch, retryCount = 3) => {

  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.issueBatchOfCertificates(
      root,
      expirationEpoch
    );

    let txHash = tx.hash;

    if (!txHash) {
      if (retryCount > 0) {
        console.log(`Unable to process the transaction. Retrying... Attempts left: ${retryCount}`);
        // Retry after a delay (e.g., 1.5 seconds)
        await holdExecution(1500);
        return issueBatchCertificateWithRetry(root, expirationEpoch, retryCount - 1);
      } else {
        return null;
      }
    }

    let polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

    return { txHash, polygonLink };

  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueBatchCertificateWithRetry(root, expirationEpoch, retryCount - 1);
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return null;
    } else if (error.reason) {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return null;
    } else {
      // If there's no specific reason provided, handle the error generally
      // console.error(messageCode.msgFailedOpsAtBlockchain, error);
      return null;
    }
  }
};

const backupFileToCloud = async (file, filePath, type) => {

  const bucketName = process.env.BUCKET_NAME;
  if (type == 1) {
    var keyPrefix = 'bulkbackup/Single Issuance/'; // Specify desired prefix here
  } else if (type == 2) {
    var keyPrefix = 'bulkbackup/Batch Issuance/';
  } else {
    var keyPrefix = 'bulkbackup/';
  }
  const keyName = keyPrefix + file;

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
    return ({ response: true, status: "SUCCESS", message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error uploading file:', error);
    return ({ response: false, status: "FAILED", message: 'An error occurred while uploading the file', details: error });
  }
};

// Function to check if a path is a directory
const findDirectories = async (items) => {
  const results = [];
  const movedFiles = [];

  for (const item of items) {
    const fullPath = path.join(uploadPath, item);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        results.push(fullPath);
      }
    } catch (err) {
      // Ignore errors (e.g., file not found)
    }
  }

  if (results.length > 0) {
    // console.log('Directories found:', results);

    for (const dir of results) {
      // console.log(`Files in directory ${dir}:`);
      try {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
          const oldPath = path.join(dir, file);
          const newPath = path.join(uploadPath, file);

          // Move file
          try {
            fs.renameSync(oldPath, newPath);
            movedFiles.push(file); // Add moved file to the list
            // console.log(`Moved ${file} to ${uploadPath}`);
          } catch (err) {
            console.error(`Error moving file ${file}:`, err);
          }
        });

        // Remove the directory if it's empty
        try {
          const remainingFiles = fs.readdirSync(dir);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(dir);
            // console.log(`Removed empty directory ${dir}`);
          }
        } catch (err) {
          console.error(`Error removing directory ${dir}:`, err);
        }
      } catch (err) {
        console.error(`Error reading directory ${dir}:`, err);
      }
    }
  } else {
    console.log('No additional directories found');
    return false;
  }
  // Return the list of moved files
  return movedFiles;
};

module.exports = {
  // Function to issue a PDF certificate
  issuePdf,

  // Function to custom issue a PDF certificate
  Issuance,

  // Function to issue a Dynamic QR with PDF certification
  issueDynamicPdf,

  // Function to issue a certification
  issue,

  // Function to issue a Batch of certifications
  batchIssueCertificate,

  // Function to issue a Dynamic Bulk issues (batch) of certifications
  dynamicBatchIssueCertificates,

  // Function to accept pdf & qr dimensions  Batch of certifications
  acceptDynamicInputs,

  // Function to validate dynamic bulk issue provided zip template files with excel data and dimensions 
  validateDynamicBulkIssueDocuments
};
