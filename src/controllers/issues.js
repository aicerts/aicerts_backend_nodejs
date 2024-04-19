// Load environment variables from .env file
require('dotenv').config();

// Import required modules
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
const { User, Issues, BatchIssues } = require("../config/schema");

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
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { handleExcelFile } = require('../services/handleExcel');
const { handleIssueCertification, handleIssuePdfCertification } = require('../services/issue');

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

// const currentDir = __dirname;
// const parentDir = path.dirname(path.dirname(currentDir));
const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // File type

const decodeKey = process.env.AUTH_KEY || 0;

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
  
    var fileBuffer = fs.readFileSync(req.file.path);
    var pdfDoc = await PDFDocument.load(fileBuffer);
  
    if (pdfDoc.getPageCount() > 1) {
      // Respond with success status and certificate details
      await cleanUploadFolder();
      return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf});
    }
    try{
    // Extracting required data from the request body
    const email = req.body.email;
    const certificateNumber = req.body.certificateNumber;
    const name = req.body.name;
    const courseName = req.body.course;
    var _grantDate = req.body.grantDate;
    var _expirationDate = req.body.expirationDate;
  
    const issueResponse = await handleIssuePdfCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate, req.file.path);
      var responseDetails = issueResponse.details ? issueResponse.details : '';
      if(issueResponse.code == 200) {

        // Set response headers for PDF download
        const certificateName = `${certificateNumber}_certificate.pdf`;
        res.set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${certificateName}"`,
        });

        res.send(issueResponse.file);

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
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid ,details: validResult.array() });
  }
  try{
  // Extracting required data from the request body
  const email = req.body.email;
  const certificateNumber = req.body.certificateNumber;
  const name = req.body.name;
  const courseName = req.body.course;
  var _grantDate = req.body.grantDate;
  var _expirationDate = req.body.expirationDate;
    
  const issueResponse = await handleIssueCertification(email, certificateNumber, name, courseName, _grantDate, _expirationDate);
  var responseDetails = issueResponse.details ? issueResponse.details : '';
  if(issueResponse.code == 200) {
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

try
{
  await isDBConnected();
    const idExist = await User.findOne({ email });
    var filePath = req.file.path;

    // Fetch the records from the Excel file
    const excelData = await handleExcelFile(filePath);
    await _fs.remove(filePath);

    try{

    if (
      (!idExist || idExist.status !== 1) || // User does not exist
      // !idExist || 
      !req.file ||
      !req.file.filename ||
      req.file.filename === 'undefined' ||
      excelData.response === false) {

      let errorMessage = messageCode.msgPlsEnterValid;
      var _details = excelData.Details;
      if (!idExist) {
        errorMessage = messageCode.msgInvalidIssuer;
        var _details = idExist.email;
      }
      else if (excelData.response == false) {
        errorMessage = excelData.message;
      } else if (idExist.status !== 1) {
        errorMessage = messageCode.msgUnauthIssuer;
      }

      res.status(400).json({ status: "FAILED", message: errorMessage, details: _details  });
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

      const hashedBatchData = batchData.map(data => {
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

        if (isPaused === true) {
          // Certificate contract paused
          var messageContent = messageCode.msgOpsRestricted;

          if (issuerAuthorized === flase) {
            messageContent = messageCode.msgIssuerUnauthrized;
          }

          return res.status(400).json({ status: "FAILED", message: messageContent });
        }

        // Generate the Merkle tree
        const tree = StandardMerkleTree.of(values, ['string']);

        const batchNumber = await newContract.getRootLength();
        const allocateBatchId = parseInt(batchNumber) + 1;
        // const allocateBatchId = 1;
        if(allDatesCommon == true){
          var dateEntry = firstItemEpoch;
        } else {
          var dateEntry = 0;
        }
        
        try {
          // Issue Batch Certifications on Blockchain
          const tx = await newContract.issueBatchOfCertificates(
            tree.root,
            dateEntry
          );

          var txHash = tx.hash;

          var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

        } catch (error) {
          if (error.reason) {
            // Extract and handle the error reason
            console.log("Error reason:", error.reason);
            return res.status(400).json({ status: "FAILED", message: error.reason });
          } else {
            // If there's no specific reason provided, handle the error generally
            console.error(messageCode.msgFailedOpsAtBlockchain, error);
            return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain });
          }
        }

        try {
          // Check mongoose connection
          const dbStatus = await isDBConnected();
          const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
          console.log(dbStatusMessage);

          var batchDetails = [];
          var batchDetailsWithQR = [];
          var insertPromises = []; // Array to hold all insert promises

          for (var i = 0; i < certificatesCount; i++) {
            var _proof = tree.getProof(i);
            let _proofHash = await keccak256(Buffer.from(_proof)).toString('hex');
            let _grantDate = await convertDateFormat(rawBatchData[i].grantDate);
            let _expirationDate = await convertDateFormat(rawBatchData[i].expirationDate);
            batchDetails[i] = {
              issuerId: idExist.issuerId,
              batchId: allocateBatchId,
              proofHash: _proof,
              encodedProof: _proofHash,
              transactionHash: txHash,
              certificateHash: hashedBatchData[i],
              certificateNumber: rawBatchData[i].certificationID,
              name: rawBatchData[i].name,
              course: rawBatchData[i].certificationName,
              grantDate: _grantDate,
              expirationDate: _expirationDate,
              email: email,
              certStatus : 1
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

            let qrCodeImage = await QRCode.toDataURL(encryptLink, {
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

            // console.log("Batch Certificate Details", batchDetailsWithQR[i]);
            insertPromises.push(insertBatchCertificateData(batchDetails[i]));
          }
          // Wait for all insert promises to resolve
          await Promise.all(insertPromises);
          var newCount = certificatesCount;
          var oldCount = idExist.certificatesIssued;
          idExist.certificatesIssued = newCount + oldCount;
          await idExist.save();

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


module.exports = {
  // Function to issue a PDF certificate
  issuePdf,

  // Function to issue a certification
  issue,

  // Function to issue a Batch of certifications
  batchIssueCertificate

};
