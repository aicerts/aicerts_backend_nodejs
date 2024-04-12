// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
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
  insertCertificateData, // Function to insert certificate data into the database
  insertBatchCertificateData, // Function to insert Batch certificate data into the database
  addLinkToPdf, // Function to add a link to a PDF file
  verifyPDFDimensions, //Verify the uploading pdf template dimensions
  calculateHash, // Function to calculate the hash of a file
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected, // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const { handleExcelFile } = require('../model/handleExcel');

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

// Create a new ethers provider using the default provider and the RPC endpoint from environment variable
const provider = new ethers.JsonRpcProvider(process.env.RPC_ENDPOINT);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const newContract = new ethers.Contract(contractAddress, abi, signer);

// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH);
const max_length = parseInt(process.env.MAX_LENGTH);

var messageCode = require("../common/codes");

// const currentDir = __dirname;
// const parentDir = path.dirname(path.dirname(currentDir));
const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // File type

// app.use("../../uploads", express.static(path.join(__dirname, "uploads")));

/**
 * API call for Certificate issue with pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issuePdf = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid ,details: validResult.array() });
  }

  var fileBuffer = fs.readFileSync(req.file.path);
  var pdfDoc = await PDFDocument.load(fileBuffer);

  if (pdfDoc.getPageCount() > 1) {
    // Respond with success status and certificate details
    await cleanUploadFolder();
    return res.status(400).json({ status: "FAILED", message: messageCode.msgMultiPagePdf});
  }
  // Extracting required data from the request body
  const email = req.body.email;
  const certificateNumber = req.body.certificateNumber;
  const name = req.body.name;
  const courseName = req.body.course;
  var _grantDate = req.body.grantDate;
  var _expirationDate = req.body.expirationDate;
  const grantDate = await convertDateFormat(_grantDate);
  const expirationDate = await convertDateFormat(_expirationDate);

try{
  await isDBConnected();
  // Check if user with provided email exists
  const idExist = await User.findOne({ email });
  // Check if certificate number already exists
  const isNumberExist = await Issues.findOne({ certificateNumber: certificateNumber });
  // Check if certificate number already exists in the Batch
  const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: certificateNumber });

  // const tempData = await verifyPDFDimensions(req.file.path);

  var _result = '';
  const templateData = await verifyPDFDimensions(req.file.path)
    .then(result => {
      // console.log("Verification result:", result);
      _result = result;
    })
    .catch(error => {
      console.error("Error during verification:", error);
    });

  // Validation checks for request data
  if (
    (!idExist || idExist.status !== 1) || // User does not exist
    _result == false ||
    isNumberExist || // Certificate number already exists 
    isNumberExistInBatch || // Certificate number already exists in Batch
    !certificateNumber || // Missing certificate number
    !name || // Missing name
    !courseName || // Missing course name
    !grantDate || // Missing grant date
    !expirationDate || // Missing expiration date
    [certificateNumber, name, courseName, grantDate, expirationDate].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
    certificateNumber.length > max_length || // Certificate number exceeds maximum length
    certificateNumber.length < min_length // Certificate number is shorter than minimum length
  ) {
    // res.status(400).json({ message: "Please provide valid details" });
    let errorMessage = messageCode.msgPlsEnterValid;

    // Check for specific error conditions and update the error message accordingly
    if (isNumberExist || isNumberExistInBatch) {
      errorMessage = messageCode.msgCertIssued;
    } else if (!grantDate || !expirationDate) {
      errorMessage = messageCode.msgProvideValidDates;
    } else if (!certificateNumber) {
      errorMessage = messageCode.msgCertIdRequired;
    } else if (certificateNumber.length > max_length) {
      errorMessage = messageCode.msgCertLength;
    } else if (certificateNumber.length < min_length) {
      errorMessage = messageCode.msgCertLength;
    } else if (!idExist) {
      errorMessage = messageCode.msgInvalidIssuer;
    } else if (idExist.status != 1) {
      errorMessage = messageCode.msgUnauthIssuer;
    }else if (_result == false) {
      await cleanUploadFolder();
      errorMessage = messageCode.msgInvalidPdfTemplate;
    }

    // Respond with error message
    res.status(400).json({ status: "FAILED", message: errorMessage });
    return;
  } else {
    // If validation passes, proceed with certificate issuance
    const fields = {
      Certificate_Number: req.body.certificateNumber,
      name: req.body.name,
      courseName: req.body.course,
      Grant_Date: grantDate,
      Expiration_Date: expirationDate,
    };
    const hashedFields = {};
    for (const field in fields) {
      hashedFields[field] = calculateHash(fields[field]);
    }
    const combinedHash = calculateHash(JSON.stringify(hashedFields));

    try {
      // Verify certificate on blockchain
      const isPaused = await newContract.paused();
      // Check if the Issuer wallet address is a valid Ethereum address
      if (!ethers.isAddress(idExist.issuerId)) {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
      }
      const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
      const val = await newContract.verifyCertificateById(certificateNumber);

      if (
        val === true ||
        isPaused === true
      ) {
        // Certificate already issued / contract paused
        var messageContent = messageCode.msgCertIssued;
        if (isPaused === true) {
          messageContent = messageCode.msgOpsRestricted;
        } else if (issuerAuthorized === false) {
          messageContent = messageCode.msgIssuerUnauthrized;
        }
        return res.status(400).json({ status: "FAILED", message: messageContent });
      }
      else {

        try {
          // If simulation successful, issue the certificate on blockchain
          const tx = await newContract.issueCertificate(
            fields.Certificate_Number,
            combinedHash
          );

          var txHash = tx.hash;

          // Generate link URL for the certificate on blockchain
          var linkUrl = `https://${process.env.NETWORK}.com/tx/${txHash}`;

        } catch (error) {
          if (error.reason) {
            // Extract and handle the error reason
            return res.status(400).json({ status: "FAILED", message: error.reason });
          } else {
            // If there's no specific reason provided, handle the error generally
            console.error(messageCode.msgFailedOpsAtBlockchain, error);
            return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
          }
        }

        // Generate encrypted URL with certificate data
        const dataWithLink = {
          ...fields, polygonLink: linkUrl
        }
        const urlLink = generateEncryptedUrl(dataWithLink);
        const legacyQR = false;

        let qrCodeData = '';
        if (legacyQR) {
          // Include additional data in QR code
          qrCodeData = `Verify On Blockchain: ${linkUrl},
          Certification Number: ${dataWithLink.Certificate_Number},
          Name: ${dataWithLink.name},
          Certification Name: ${dataWithLink.courseName},
          Grant Date: ${dataWithLink.Grant_Date},
          Expiration Date: ${dataWithLink.Expiration_Date}`;
        } else {
          // Directly include the URL in QR code
          qrCodeData = urlLink;
        }

        const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
          errorCorrectionLevel: "H", width: 450, height: 450
        });

        file = req.file.path;
        const outputPdf = `${fields.Certificate_Number}${name}.pdf`;

        // Add link and QR code to the PDF file
        const opdf = await addLinkToPdf(
          path.join("./", '.', file),
          outputPdf,
          linkUrl,
          qrCodeImage,
          combinedHash
        );

        // Read the generated PDF file
        const fileBuffer = fs.readFileSync(outputPdf);

        try {
          // Check mongoose connection
          const dbStatus = await isDBConnected();
          const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
          console.log(dbStatusMessage);

          // Insert certificate data into database
          const issuerId = idExist.issuerId;
          const certificateData = {
            issuerId,
            transactionHash: txHash,
            certificateHash: combinedHash,
            certificateNumber: fields.Certificate_Number,
            name: fields.name,
            course: fields.courseName,
            grantDate: fields.Grant_Date,
            expirationDate: fields.Expiration_Date
          };
          await insertCertificateData(certificateData);

          // Set response headers for PDF download
          const certificateName = `${fields.Certificate_Number}_certificate.pdf`;

          res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${certificateName}"`,
          });
          res.send(fileBuffer);

          // Delete files
          if (fs.existsSync(outputPdf)) {
            // Delete the specified file
            fs.unlinkSync(outputPdf);
          }

          // Always delete the temporary file (if it exists)
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }

          await cleanUploadFolder();

        } catch (error) {
          // Handle mongoose connection error (log it, response an error, etc.)
          console.error("Internal server error", error);
          return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
        }
      }
    } catch (error) {
      // Handle mongoose connection error (log it, response an error, etc.)
      console.error("Internal server error", error);
      return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
    }
  }
} catch (error) {
  // Handle mongoose connection error (log it, response an error, etc.)
  console.error("Internal server error", error);
  return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
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
  // Extracting required data from the request body
  const email = req.body.email;
  const certificateNumber = req.body.certificateNumber;
  const name = req.body.name;
  const courseName = req.body.course;
  var _grantDate = req.body.grantDate;
  var _expirationDate = req.body.expirationDate;

  const grantDate = await convertDateFormat(_grantDate);
  const expirationDate = await convertDateFormat(_expirationDate);

  try
  {
    await isDBConnected();
  // Check if user with provided email exists
  const idExist = await User.findOne({ email });
  // Check if certificate number already exists
  const isNumberExist = await Issues.findOne({ certificateNumber: certificateNumber });
  // Check if certificate number already exists in the Batch
  const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: certificateNumber });

  // Validation checks for request data
  if (
    (!idExist || idExist.status !== 1) || // User does not exist
    // !idExist || // User does not exist
    isNumberExist || // Certificate number already exists 
    isNumberExistInBatch || // Certificate number already exists in Batch
    !certificateNumber || // Missing certificate number
    !name || // Missing name
    !courseName || // Missing course name
    (!grantDate || grantDate == 'Invalid date') || // Missing grant date
    (!expirationDate || expirationDate == 'Invalid date') || // Missing expiration date
    [certificateNumber, name, courseName, grantDate, expirationDate].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
    certificateNumber.length > max_length || // Certificate number exceeds maximum length
    certificateNumber.length < min_length // Certificate number is shorter than minimum length
  ) {
    // Prepare error message
    let errorMessage = messageCode.msgPlsEnterValid;

    // Check for specific error conditions and update the error message accordingly
    if (isNumberExist || isNumberExistInBatch) {
      errorMessage = messageCode.msgCertIssued;
    } else if ((!grantDate || grantDate == 'Invalid date') || (!expirationDate || expirationDate == 'Invalid date')) {
      errorMessage = messageCode.msgProvideValidDates;
    } else if (!certificateNumber) {
      errorMessage = messageCode.msgCertIdRequired;
    } else if (certificateNumber.length > max_length) {
      errorMessage = messageCode.msgCertLength;
    } else if (certificateNumber.length < min_length) {
      errorMessage = messageCode.msgCertLength;
    } else if (!idExist) {
      errorMessage = messageCode.msgInvalidIssuer;
    } else if (idExist.status !== 1) {
      errorMessage = messageCode.msgUnauthIssuer;
    }

    // Respond with error message
    res.status(400).json({ status: "FAILED", message: errorMessage });
    return;
  } else {
    try {
      // Prepare fields for the certificate
      const fields = {
        Certificate_Number: certificateNumber,
        name: name,
        courseName: courseName,
        Grant_Date: grantDate,
        Expiration_Date: expirationDate,
      };
      // Hash sensitive fields
      const hashedFields = {};
      for (const field in fields) {
        hashedFields[field] = calculateHash(fields[field]);
      }
      const combinedHash = calculateHash(JSON.stringify(hashedFields));

      try {
        // Verify certificate on blockchain
        const isPaused = await newContract.paused();
        // Check if the Issuer wallet address is a valid Ethereum address
        if (!ethers.isAddress(idExist.issuerId)) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
        }
        const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
        const val = await newContract.verifyCertificateById(certificateNumber);

        if (
          val === true ||
          isPaused === true
        ) {
          // Certificate already issued / contract paused
          var messageContent = messageCode.msgCertIssued;
          if (isPaused === true) {
            messageContent = messageCode.msgOpsRestricted;
          } else if (issuerAuthorized === false) {
            messageContent = messageCode.msgIssuerUnauthrized;
          }
          return res.status(400).json({ status: "FAILED", message: messageContent });
        } else {
          try {
            // If simulation successful, issue the certificate on blockchain
            const tx = await newContract.issueCertificate(
              certificateNumber,
              combinedHash
            );

            // await tx.wait();
            var txHash = tx.hash;

            // Generate link URL for the certificate on blockchain
            var polygonLink = `https://${process.env.NETWORK}.com/tx/${txHash}`;

          } catch (error) {
            if (error.reason) {
              // Extract and handle the error reason
              console.log("Error reason:", error.reason);
              return res.status(400).json({ status: "FAILED", message: error.reason });
            } else {
              // If there's no specific reason provided, handle the error generally
              console.error(messageCode.msgFailedOpsAtBlockchain, error);
              return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
            }
          }

          // Generate encrypted URL with certificate data
          const dataWithLink = { ...fields, polygonLink: polygonLink }
          const urlLink = generateEncryptedUrl(dataWithLink);

          // Generate QR code based on the URL
          const legacyQR = false;
          let qrCodeData = '';
          if (legacyQR) {
            // Include additional data in QR code
            qrCodeData = `Verify On Blockchain: ${polygonLink},
          Certification Number: ${certificateNumber},
          Name: ${name},
          Certification Name: ${courseName},
          Grant Date: ${grantDate},
          Expiration Date: ${expirationDate}`;

          } else {
            // Directly include the URL in QR code
            qrCodeData = urlLink;
          }

          const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
            errorCorrectionLevel: "H",
            width: 450, // Adjust the width as needed
            height: 450, // Adjust the height as needed
          });


          try {
            // Check mongoose connection
            const dbStatus = await isDBConnected();
            const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
            console.log(dbStatusMessage);

            const issuerId = idExist.issuerId;

            var certificateData = {
              issuerId,
              transactionHash: txHash,
              certificateHash: combinedHash,
              certificateNumber: fields.Certificate_Number,
              name: fields.name,
              course: fields.courseName,
              grantDate: fields.Grant_Date,
              expirationDate: fields.Expiration_Date
            };

            // Insert certificate data into database
            await insertCertificateData(certificateData);

          } catch (error) {
            // Handle mongoose connection error (log it, response an error, etc.)
            console.error(messageCode.msgInternalError, error);
            return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
          }

          // Respond with success message and certificate details
          res.status(200).json({
            status: "SUCCESS",
            message: messageCode.msgCertIssuedSuccess,
            qrCodeImage: qrCodeImage,
            polygonLink: polygonLink,
            details: certificateData,
          });
        }

      } catch (error) {
        // Internal server error
        console.error(error);
        res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
      }
    } catch (error) {
      // Internal server error
      console.error(error);
      return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
    }
  }
} catch (error) {
  // Internal server error
  console.error(error);
  return res.status(400).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
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

        try {
          // Issue Batch Certifications on Blockchain
          const tx = await newContract.issueBatchOfCertificates(
            tree.root
          );

          var txHash = tx.hash;

          var polygonLink = `https://${process.env.NETWORK}.com/tx/${txHash}`;

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
              expirationDate: _expirationDate
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
            // await insertBatchCertificateData(batchDetails[i]);
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

  // Function to issue a certificate
  issue,

  // Function to issue a Batch of certificates
  batchIssueCertificate,

};
