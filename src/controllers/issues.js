// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const QRCode = require("qrcode");
const fs = require("fs");
const _fs = require("fs-extra");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const keccak256 = require('keccak256');
const { validationResult } = require("express-validator");

const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../common/cryptoFunction");

// Import MongoDB models
const { User, Issues, BatchIssues, ServiceAccountQuotas } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");


// Importing functions from a custom module
const {
  convertDateFormat,
  convertDateToEpoch,
  insertBatchCertificateData, // Function to insert Batch certificate data into the database
  calculateHash, // Function to calculate the hash of a file
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected, // Function to check if the database connection is established
  insertUrlData,
  getIssuerServiceCredits,
  updateIssuerServiceCredits
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { handleExcelFile } = require('../services/handleExcel');
const { handleIssueCertification, handleIssuePdfCertification, handleIssueDynamicPdfCertification } = require('../services/issue');

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

  const fileBuffer = fs.readFileSync(req.file.path);
  const pdfDoc = await PDFDocument.load(fileBuffer);
  let _expirationDate;

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    await cleanUploadFolder();
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
          if(fetchCredits === true){
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

const issueDynamicPdf = async (req, res) => {
  if (!req.file.path) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMustPdf });
  }

  const fileBuffer = fs.readFileSync(req.file.path);
  const pdfDoc = await PDFDocument.load(fileBuffer);

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    await cleanUploadFolder();
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

    if(!email || !certificateNumber || !certificateName || !_positionX || !_positionY || !_qrsize || !customFields){
      res.status(400).json({ status: "FAILED", message: messageCode.msgInputProvide});
      return;
    }

    const issueResponse = await handleIssueDynamicPdfCertification(email, certificateNumber, certificateName, customFields, req.file.path, _positionX, _positionY, _qrsize);
    const responseDetails = issueResponse.details ? issueResponse.details : '';
    if (issueResponse.code == 200) {

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
          if(fetchCredits === true){
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
 * API call for Batch Certificates issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const batchIssueCertificate = async (req, res) => {
  const email = req.body.email;
  // Check if the file path matches the pattern
  if (req.file.mimetype != fileType) {
    // File path does not match the pattern
    const errorMessage = messageCode.msgMustExcel;
    await cleanUploadFolder();
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
        if(fetchCredits === true){
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

            await cleanUploadFolder();

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

const issueBatchCertificateWithRetry = async (root, expirationEpoch, retryCount = 3) => {

  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.issueBatchOfCertificates(
      root,
      expirationEpoch
    );

    let txHash = tx.hash;

    let polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

    return { txHash, polygonLink };

  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueCertificateWithRetry(root, expirationEpoch, retryCount - 1);
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

module.exports = {
  // Function to issue a PDF certificate
  issuePdf,

  issueDynamicPdf,

  // Function to issue a certification
  issue,

  // Function to issue a Batch of certifications
  batchIssueCertificate

};
