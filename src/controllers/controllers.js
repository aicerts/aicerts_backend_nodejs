// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
const QRCode = require("qrcode");
const fs = require("fs");
const AWS = require('../config/aws-config');
const _fs = require("fs-extra");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

// Import custom cryptoFunction module for encryption and decryption
const { decryptData, generateEncryptedUrl } = require("../common/cryptoFunction");
// Import custom authUtils module for JWT token generation
const { generateJwtToken } = require("../common/authUtils");

// Import MongoDB models
const { Admin, User, Issues, BatchIssues } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Importing functions from a custom module
const {
  fetchExcelRecord,
  convertDateFormat,
  findInvalidDates,
  insertCertificateData, // Function to insert certificate data into the database
  insertBatchCertificateData, // Function to insert Batch certificate data into the database
  findRepetitiveIdNumbers, // Find repetitive Certification ID
  extractQRCodeDataFromPDF, // Function to extract QR code data from a PDF file
  addLinkToPdf, // Function to add a link to a PDF file
  verifyPDFDimensions, //Verify the uploading pdf template dimensions
  calculateHash, // Function to calculate the hash of a file
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected, // Function to check if the database connection is established
  sendEmail, // Function to send an email on approved
  rejectEmail // Function to send an email on rejected
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

// Create a new ethers provider using the default provider and the RPC endpoint from environment variable
const provider = new ethers.JsonRpcProvider(process.env.RPC_ENDPOINT);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
// const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const new_contract = new ethers.Contract(contractAddress, abi, signer); 

// Import bcrypt for hashing passwords
const bcrypt = require("bcrypt");

// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH);
const max_length = parseInt(process.env.MAX_LENGTH);

let linkUrl; // Variable to store a link URL
let detailsQR; // Variable to store details of a QR code

const currentDir = __dirname;
const parentDir = path.dirname(path.dirname(currentDir));

app.use("../../uploads", express.static(path.join(__dirname, "uploads")));
 
/**
 * API call for Certificate issue with pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issuePdf = async (req, res) => {
  // Extracting required data from the request body
  const email = req.body.email;
  const Certificate_Number = req.body.certificateNumber;
  const name = req.body.name;
  const courseName = req.body.course;
  var _Grant_Date = req.body.grantDate;
  var _Expiration_Date = req.body.expirationDate;
  const Grant_Date = await convertDateFormat(_Grant_Date);
  const Expiration_Date = await convertDateFormat(_Expiration_Date);

  // Check if user with provided email exists
  const idExist = await User.findOne({ email });
  // Check if certificate number already exists
  const isNumberExist = await Issues.findOne({ certificateNumber: Certificate_Number });
  // Check if certificate number already exists in the Batch
  const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: Certificate_Number });

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
    (!idExist || idExist.status !== 1)|| // User does not exist
    _result == false||
    isNumberExist || // Certificate number already exists 
    isNumberExistInBatch || // Certificate number already exists in Batch
    !Certificate_Number || // Missing certificate number
    !name || // Missing name
    !courseName || // Missing course name
    !Grant_Date || // Missing grant date
    !Expiration_Date || // Missing expiration date
    [Certificate_Number, name, courseName, Grant_Date, Expiration_Date].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
    Certificate_Number.length > max_length || // Certificate number exceeds maximum length
    Certificate_Number.length < min_length // Certificate number is shorter than minimum length
  ) {
    // res.status(400).json({ message: "Please provide valid details" });
    let errorMessage = "Please provide valid details";
    
    // Check for specific error conditions and update the error message accordingly
    if (isNumberExist || isNumberExistInBatch) {
      errorMessage = "Certification number already exists";
    } else if (!Grant_Date || !Expiration_Date) {
          errorMessage = "Please provide valid Dates";
    } else if (!Certificate_Number) {
      errorMessage = "Certification number is required";
    } else if (Certificate_Number.length > max_length) {
      errorMessage = `Certification number should be less than ${max_length} characters`;
    } else if (Certificate_Number.length < min_length) {
      errorMessage = `Certification number should be at least ${min_length} characters`;
    } else if (!idExist) {
      errorMessage = `Invalid Issuer Email`;
    } else if(idExist.status != 1) {
      errorMessage = `Unauthorised Issuer Email`;
    } else if(_result == false) {
      await cleanUploadFolder();
      errorMessage = `Invalid PDF (Certification Template) dimensions`;
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
    Grant_Date: Grant_Date,
    Expiration_Date: Expiration_Date,
  };
  const hashedFields = {};
  for (const field in fields) {
    hashedFields[field] = calculateHash(fields[field]);
  }
  const combinedHash = calculateHash(JSON.stringify(hashedFields));  

      // Verify certificate on blockchain
      const isPaused = await new_contract.paused();
      const issuerAuthorized = await new_contract.hasRole(process.env.ISSUER_ROLE, idExist.id);
      const val = await new_contract.verifyCertificateById(Certificate_Number);

      if (
        val === true || 
        isPaused === true
        ) {
        // Certificate already issued / contract paused
        var messageContent = "Certification already issued";
        if(isPaused === true) {
          messageContent = "Operation restricted by the Blockchain";
        } else if (issuerAuthorized === false) {
          messageContent = "Unauthorized Issuer to perform operation on Blockchain";
        }
        return res.status(400).json({ status: "FAILED", message: messageContent });
      } 
      else {
       
        try{ 
        // If simulation successful, issue the certificate on blockchain
        const tx = await new_contract.issueCertificate(
          fields.Certificate_Number,
          combinedHash
        );

        var txHash = tx.hash;

      // Generate link URL for the certificate on blockchain
      var linkUrl = `https://${process.env.NETWORK}.com/tx/${txHash}`;

      } catch (error) {
        // Handle the error During the transaction
        console.error('Error occurred during transaction execution:', error.message);
      }

      // Generate encrypted URL with certificate data
      const dataWithLink = {
        ...fields,polygonLink:linkUrl
              }
      const urlLink = generateEncryptedUrl(dataWithLink);
      const legacyQR = false;

      let qrCodeData = '';
      if (legacyQR) {
          // Include additional data in QR code
          qrCodeData = `Verify On Blockchain: ${linkUrl},
          Certification Number: ${Certificate_Number},
          Name: ${name},
          Certification Name: ${courseName},
          Grant Date: ${Grant_Date},
          Expiration Date: ${Expiration_Date}`;
              
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
          path.join(parentDir, '.', file),
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
          const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
          console.log(dbStatusMessage);

          // Insert certificate data into database
          const id = idExist.id;
          const certificateData = {
            id,
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
          
        }catch (error) {
          // Handle mongoose connection error (log it, throw an error, etc.)
          console.error("Internal server error", error);
        }               
    }
  }
};


/**
 * API call for Certificate issue without pdf template.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const issue = async (req, res) => {
  // Extracting required data from the request body
  const email = req.body.email;
  const Certificate_Number = req.body.certificateNumber;
  const name = req.body.name;
  const courseName = req.body.course;
  var _Grant_Date = req.body.grantDate;
  var _Expiration_Date = req.body.expirationDate;

  const Grant_Date = await convertDateFormat(_Grant_Date);
  const Expiration_Date = await convertDateFormat(_Expiration_Date);

  // Check if user with provided email exists
  const idExist = await User.findOne({ email });
  // Check if certificate number already exists
  const isNumberExist = await Issues.findOne({certificateNumber: Certificate_Number});
  // Check if certificate number already exists in the Batch
  const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: Certificate_Number });

  // Validation checks for request data
  if (
    (!idExist || idExist.status !== 1)|| // User does not exist
    // !idExist || // User does not exist
    isNumberExist || // Certificate number already exists 
    isNumberExistInBatch || // Certificate number already exists in Batch
    !Certificate_Number || // Missing certificate number
    !name || // Missing name
    !courseName || // Missing course name
    !Grant_Date || // Missing grant date
    !Expiration_Date || // Missing expiration date
    [Certificate_Number, name, courseName, Grant_Date, Expiration_Date].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
    Certificate_Number.length > max_length || // Certificate number exceeds maximum length
    Certificate_Number.length < min_length // Certificate number is shorter than minimum length
  ) {
    // Prepare error message
      let errorMessage = "Please provide valid details";
    
      // Check for specific error conditions and update the error message accordingly
      if (isNumberExist || isNumberExistInBatch) {
          errorMessage = "Certification number already exists";
      } else if (!Grant_Date || !Expiration_Date) {
            errorMessage = "Please provide valid Dates";
      } else if (!Certificate_Number) {
          errorMessage = "Certification number is required";
      } else if (Certificate_Number.length > max_length) {
          errorMessage = `Certification number should be less than ${max_length} characters`;
      } else if (Certificate_Number.length < min_length) {
          errorMessage = `Certification number should be at least ${min_length} characters`;
      } else if(!idExist) {
          errorMessage = `Invalid Issuer Email`;
      } else if(idExist.status !== 1) {
        errorMessage = `Unauthorised Issuer Email`;
      }

      // Respond with error message
      res.status(400).json({ status: "FAILED", message: errorMessage });
      return;
  } else {
    try {
      // Prepare fields for the certificate
      const fields = {
        Certificate_Number: Certificate_Number,
        name: name,
        courseName: courseName,
        Grant_Date: Grant_Date,
        Expiration_Date: Expiration_Date,
      };
      // Hash sensitive fields
      const hashedFields = {};
      for (const field in fields) {
        hashedFields[field] = calculateHash(fields[field]);
      }
      const combinedHash = calculateHash(JSON.stringify(hashedFields));

      // Verify certificate on blockchain
      const isPaused = await new_contract.paused();
      const issuerAuthorized = await new_contract.hasRole(process.env.ISSUER_ROLE, idExist.id);
      const val = await new_contract.verifyCertificateById(Certificate_Number);

      if (
        val === true || 
        isPaused === true
        ) {
        // Certificate already issued / contract paused
        var messageContent = "Certification already issued";
        if(isPaused === true) {
          messageContent = "Operation restricted by the Blockchain";
        } else if (issuerAuthorized === false) {
          messageContent = "Unauthorized Issuer to perform operation on Blockchain";
        }
        return res.status(400).json({ status: "FAILED", message: messageContent });
      }else {
          try{
          // If simulation successful, issue the certificate on blockchain
          const tx = await new_contract.issueCertificate(
            Certificate_Number,
            combinedHash
          );

          // await tx.wait();
          var txHash = tx.hash;

          // Generate link URL for the certificate on blockchain
          var polygonLink = `https://${process.env.NETWORK}.com/tx/${txHash}`;

          } catch (error) {
            // Handle the error During the transaction
            console.error('Error occurred during transaction execution:', error.message);
          }

      // Generate encrypted URL with certificate data
      const dataWithLink = {...fields,polygonLink:polygonLink}
      const urlLink = generateEncryptedUrl(dataWithLink);

      // Generate QR code based on the URL
      const legacyQR = false;
      let qrCodeData = '';
      if (legacyQR) {
          // Include additional data in QR code
          qrCodeData = `Verify On Blockchain: ${polygonLink},
          Certification Number: ${Certificate_Number},
          Name: ${name},
          Certification Name: ${courseName},
          Grant Date: ${Grant_Date},
          Expiration Date: ${Expiration_Date}`;
              
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
          const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
          console.log(dbStatusMessage);

          const id = idExist.id;

          var certificateData = {
            id,
            transactionHash: txHash,
            certificateHash: combinedHash,
            certificateNumber: Certificate_Number,
            name: name,
            course: courseName,
            grantDate: Grant_Date,
            expirationDate: Expiration_Date
          };

          // Insert certificate data into database
          await insertCertificateData(certificateData);

          }catch (error) {
          // Handle mongoose connection error (log it, throw an error, etc.)
          console.error("Internal server error", error);
        }

        // Respond with success message and certificate details
          res.status(200).json({
            message: "Certificate issued successfully",
            qrCodeImage: qrCodeImage,
            polygonLink: polygonLink,
            details: certificateData,
          });
      }

    } catch (error) {
       // Internal server error
      console.error(error);
      res.status(500).json({ status: "FAILED", message: "Internal Server Error" });
    }
  }
};

/**
 * API call for Batch Certificates issue.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const batchCertificateIssue = async (req, res) => {
  const email = req.body.email;
  
  file = req.file.path;

  const idExist = await User.findOne({ email });

  var filePath = req.file.path;

  // Fetch the records from the Excel file
  const excelData = await fetchExcelRecord(filePath);

  await _fs.remove(filePath);

    if (
      (!idExist || idExist.status !== 1)|| // User does not exist
      // !idExist || 
      !req.file || 
      !req.file.filename || 
      req.file.filename === 'undefined' || 
      excelData.response === false) {
  
    let errorMessage = "Please provide valid details";
    if(!idExist){
      errorMessage = "Invalid Issuer";
    }
    else if(excelData.response == false){
      errorMessage =  excelData.message;
    } else if(idExist.status !== 1) {
      errorMessage = `Unauthorised Issuer Email`;
    } 
    

    res.status(400).json({ status: "FAILED", message: errorMessage });
    return;
    
  } else {

    // console.log("The certificates details", excelData.message[0]);

    // Batch Certification Formated Details
    const rawBatchData = excelData.message[0];
    // Certification count
    const certificatesCount = excelData.message[1];
    // certification unformated details
    const batchData = excelData.message[2];

    const certificationIDs = rawBatchData.map(item => item.certificationID);

    const certificationGrantDates = rawBatchData.map(item => item.grantDate);

    const certificationExpirationDates = rawBatchData.map(item => item.expirationDate);

    // Initialize an empty list to store matching IDs
    const matchingIDs = [];
    const repetitiveNumbers = await findRepetitiveIdNumbers(certificationIDs);

    if(repetitiveNumbers.length > 0){
      res.status(400).json({ status: "FAILED", message: "Excel file has Repetition in Certification IDs", Details: repetitiveNumbers });
      return;
    }

    const invalidGrantDateFormat = await findInvalidDates(certificationGrantDates);
    const invalidExpirationDateFormat = await findInvalidDates(certificationExpirationDates);

    if(invalidGrantDateFormat.length > 0 && invalidExpirationDateFormat.length > 0){
      res.status(400).json({ status: "FAILED", message: "Excel file has Invalid Date Format", Details: [invalidGrantDateFormat, invalidExpirationDateFormat] });
      return;
    }

    // Assuming BatchIssues is your MongoDB model
    for (const id of certificationIDs) {
      const issueExist = await Issues.findOne({ certificateNumber: id });
      const _issueExist = await BatchIssues.findOne({ certificateNumber: id });
      if (issueExist || _issueExist) {
        matchingIDs.push(id);
      }
    }

    if(matchingIDs.length>0){

      res.status(400).json({ status: "FAILED", message: "Excel file has Existing Certification IDs", Details: matchingIDs });
      return;
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
      const isPaused = await new_contract.paused();
      const issuerAuthorized = await new_contract.hasRole(process.env.ISSUER_ROLE, idExist.id);
    
      if (isPaused === true) {
        // Certificate contract paused
        var messageContent = "Operation restricted by the Blockchain";

        if(issuerAuthorized === flase) {
          messageContent = "Unauthorized Issuer to perform operation on Blockchain";
        }
        
        return res.status(400).json({ status: "FAILED", message: messageContent});
      } 
      
      // Generate the Merkle tree
      const tree = StandardMerkleTree.of(values, ['string']);

      const batchNumber = await new_contract.getRootLength();
      const allocateBatchId = parseInt(batchNumber) + 1;
      // const allocateBatchId = 1;
            
      try{
        // Issue Batch Certifications on Blockchain
          const tx = await new_contract.issueBatchOfCertificates(
            tree.root
        );
        
        var txHash = tx.hash;

        var polygonLink = `https://${process.env.NETWORK}.com/tx/${txHash}`;
        
      } catch (error) {
        // Handle the error During the transaction
        console.error('Error occurred during transaction execution:', error.message);
      }

      try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
        console.log(dbStatusMessage);
          
          var batchDetails = [];
          var batchDetailsWithQR = [];
          var insertPromises = []; // Array to hold all insert promises
          
          for (var i = 0; i < certificatesCount; i++) {
            var _proof = tree.getProof(i);
            let _grantDate = await convertDateFormat(rawBatchData[i].grantDate);
            let _expirationDate = await convertDateFormat(rawBatchData[i].expirationDate);
            batchDetails[i] = {
                  id: idExist.id,
                  batchId: allocateBatchId,
                  proofHash: _proof,
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
                id: idExist.id,
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
              await insertBatchCertificateData(batchDetails[i]);
              insertPromises.push(insertBatchCertificateData(batchDetails[i]));
        }
        // Wait for all insert promises to resolve
        await Promise.all(insertPromises);
        console.log("Data inserted");

        res.status(200).json({
          status: "SUCCESS",
          message: "Batch of Certifications issued successfully",
          polygonLink: polygonLink,
          details: batchDetailsWithQR,
        });

        await cleanUploadFolder();

        } catch (error) {
        // Handle mongoose connection error (log it, throw an error, etc.)
        console.error("Internal server error", error);
      }

  } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ status: 'FAILED', error: 'Internal Server Error.' });
  }
}
};

/**
 * Define a route that takes a hash parameter.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const polygonLink = async (req, res) => {
  res.json({ linkUrl });
};

/**
 * Verify Certification page with PDF QR - Blockchain URL.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verify = async (req, res) => {
  // Extracting file path from the request
  file = req.file.path;

  try {
    // Extract QR code data from the PDF file
    const certificateData = await extractQRCodeDataFromPDF(file);
    if(certificateData === false) {
      await cleanUploadFolder();
      return res.status(400).json({ status: "FAILED", message: "Certification is not valid" });
    }

    // Extract blockchain URL from the certificate data
    const blockchainUrl = certificateData["Polygon URL"];

    // Check if a blockchain URL exists and is valid
    if (blockchainUrl && blockchainUrl.length > 0) {
      // Respond with success status and certificate details
      res.status(200).json({ status: "SUCCESS", message: "Certification is valid", Details: certificateData });
    } else {
      // Respond with failure status if no valid blockchain URL is found
      res.status(400).json({ status: "FAILED", message: "Certification is not valid" });
    }
  } catch (error) {
    // If an error occurs during verification, respond with failure status
    const verificationResponse = {
      status: "FAILED", 
      message: "Certification is not valid"
    };

    res.status(400).json(verificationResponse);
  }
  
  // Delete the uploaded file after verification
  if (fs.existsSync(file)) {
     fs.unlinkSync(file);
  }

  // Clean up the upload folder
  await cleanUploadFolder();
};

/**
 * Verify certificate with ID - Blockchain URL.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyWithId = async (req, res) => {
    inputId = req.body.id;

  try {
    const response = await new_contract.verifyCertificateById(inputId);

    if (response === true) {
      const certificateNumber = inputId;
    try {
          // Check mongoose connection
          const dbStatus = await isDBConnected();
          const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
          console.log(dbStatusMessage);

      var certificateExist = await Issues.findOne({ certificateNumber });

      const verificationResponse = {
        status: "SUCCESS",
        message: "Valid Certification",
        details: (certificateExist) ? certificateExist : certificateNumber
      };
      res.status(200).json(verificationResponse);
      
      }catch (error) {
          console.error("Internal server error", error);
      }
    } else {
      return res.status(400).json({ status: "FAILED", message: "Certification doesn't exist" });
    }
    } catch (error) {
      res.status(500).json({
        status: "FAILED",
        message: "Internal Server error",
      });
    } 

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
      let parsedData;
      if(originalData !== null){
     parsedData = {
          "Certificate Number": originalData.Certificate_Number || "",
          "Course Name": originalData.courseName || "",
          "Expiration Date": originalData.Expiration_Date || "",
          "Grant Date": originalData.Grant_Date || "",
          "Name": originalData.name || "",
          "Polygon URL": originalData.polygonLink || ""
        };
        isValid = true
      }
        

      // Respond with the verification status and decrypted data if valid
      if (isValid) {
          res.status(200).json({ status: "PASSED", message: "Verified", data: parsedData });
      } else {
          res.status(200).json({ status: "FAILED", message: "Not Verified" });
      }
  } catch (error) {
      // Handle errors and send an appropriate response
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * API call for Batch Certificates verify with Certification ID.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyBatchCertificate = async (req, res) => {

  const { id } = req.body;
  try {
    // const tree = StandardMerkleTree.load(JSON.parse(fs.readFileSync('tree.json', 'utf8')));
    const issueExist = await BatchIssues.findOne({ certificateNumber: id });
  
  if (issueExist) {
      const batchNumber = (issueExist.batchId)-1;
      const dataHash = issueExist.certificateHash;
      const proof = issueExist.proofHash;

      // Blockchain processing.
      const val = await new_contract.verifyCertificateInBatch(batchNumber, dataHash, proof);

      var _polygonLink = `https://${process.env.NETWORK}.com/tx/${issueExist.transactionHash}`;

      var completeResponse = {issueExist,polygonLink:_polygonLink};

      return res.status(val ? 200 : 400).json({ status: val ? 'SUCCESS' : 'FAILED', Message: val ? "Valid Certification ID" : 'Invalid Certification ID', details: val ? completeResponse : 'NA' });
    
    } else {
        
    return res.status(400).json({ status: 'FAILED', error: 'Invalid Certification ID' });
    }
      }
  catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ status: 'FAILED', error: 'Internal Server Error.' });
  }
}; 

/**
 * API call for Single / Batch Certificates verify with Certification ID.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const verifyCertificationId = async (req, res) => {
  const inputId = req.body.id;
  const dbStatus = await isDBConnected();
  const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
  console.log(dbStatusMessage);

  const singleIssueExist = await Issues.findOne({ certificateNumber : inputId });
  const batchIssueExist = await BatchIssues.findOne({ certificateNumber : inputId });

  // Blockchain processing.
  const response = await new_contract.verifyCertificateById(inputId);

  // Validation checks for request data
  if ([inputId].some(value => typeof value !== "string" || value == "string") || (!batchIssueExist && response === false)) {
    // res.status(400).json({ message: "Please provide valid details" });
    let errorMessage = "Please provide valid details";
    
    // Check for specific error conditions and update the error message accordingly
    if (!batchIssueExist && response === false) {
      errorMessage = "Certification doesn't exist";
    }

    // Respond with error message
    return res.status(400).json({ status: "FAILED", message: errorMessage });
  } else {

  if (response === true || singleIssueExist != null) {
    if(singleIssueExist == null) {
      const _verificationResponse = {
        status: "FAILED",
        message: "Certification is valid but No Details found",
        details: inputId
      };

      return res.status(400).json(_verificationResponse);
    }
    try {
      var _polygonLink = `https://${process.env.NETWORK}.com/tx/${singleIssueExist.transactionHash}`;

      var completeResponse = {
      'Certificate Number': singleIssueExist.certificateNumber,
      'Course Name': singleIssueExist.course,
      'Expiration Date': singleIssueExist.expirationDate,
      'Grant Date': singleIssueExist.expirationDate,
      'Name': singleIssueExist.name,
      'Polygon URL':_polygonLink};

      const foundCertification = (singleIssueExist != null) ? completeResponse : inputId;

      const verificationResponse = {
        status: "SUCCESS",
        message: "Certification is valid",
        details: foundCertification
      };
      res.status(200).json(verificationResponse);
      
      }catch (error) {
        res.status(500).json({ status: 'FAILED', message: 'Internal Server Error.' });
      }

    } else if(batchIssueExist != null) {
      const batchNumber = (batchIssueExist.batchId)-1;
      const dataHash = batchIssueExist.certificateHash;
      const proof = batchIssueExist.proofHash;

      // Blockchain processing.
      const val = await new_contract.verifyCertificateInBatch(batchNumber, dataHash, proof);

      if (val === true) {
        try {

          var _polygonLink = `https://${process.env.NETWORK}.com/tx/${batchIssueExist.transactionHash}`;

          var completeResponse = {
            'Certificate Number': batchIssueExist.certificateNumber,
            'Course Name': batchIssueExist.course,
            'Expiration Date': batchIssueExist.expirationDate,
            'Grant Date': batchIssueExist.expirationDate,
            'Name': batchIssueExist.name,
            'Polygon URL':_polygonLink};
    
          const _verificationResponse = {
            status: "SUCCESS",
            message: "Certification is valid",
            details: completeResponse
          };

          res.status(200).json(_verificationResponse);
          
          }catch (error) {
            res.status(500).json({ status: 'FAILED', message: 'Internal Server Error.' });
          }
        } else {
          return res.status(400).json({ status: "FAILED", message: "Certification doesn't exist" });
        }
    } 
  }

}; 

/**
 * API call for Admin Signup.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const signup = async (req, res) => {
  // Extracting name, email, and password from the request body
  let { name, email, password } = req.body;

  // Trim whitespace from input fields
  name = name.trim();
  email = email.trim();
  password = password.trim();

  // Validation checks for input fields
  if (name == "" || email == "" || password == "") {
    // Empty input fields
    res.json({
      status: "FAILED",
      message: "Empty input fields!",
    });
  } else if (!/^[a-zA-Z ]*$/.test(name)) {
    // Invalid name format
    res.json({
      status: "FAILED",
      message: "Invalid name entered",
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    // Invalid email format
    res.json({
      status: "FAILED",
      message: "Invalid email entered",
    });
  } else if (password.length < 8) {
    // Password too short
    res.json({
      status: "FAILED",
      message: "Password is too short!",
    });
  } else {
    try {
      // Check mongoose connection
      const dbStatus = await isDBConnected();
      const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
      console.log(dbStatusMessage);

      // Checking if Admin already exists
      const existingAdmin = await Admin.findOne({ email });

      if (existingAdmin) {
        // Admin with the provided email already exists
        res.json({
          status: "FAILED",
          message: "Admin with the provided email already exists",
        });
        return; // Stop execution if user already exists
      }

       // password handling
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Save new user
      const newAdmin = new Admin({
        name,
        email,
        password: hashedPassword,
        status: false
      });

      const savedAdmin = await newAdmin.save();
      res.json({
        status: "SUCCESS",
        message: "Signup successful",
        data: savedAdmin,
      });
    } catch (error) {
      // An error occurred during signup process
      res.json({
        status: "FAILED",
        message: "An error occurred",
      });
    }  
  }
};

/**
 * API call for Admin Login.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const login = async (req, res) => {
  let { email, password } = req.body;

  // Check if email or password is empty
  if (email == "" || password == "") {
    res.json({
      status: "FAILED",
      message: "Empty credentials supplied",
    });
  } else {
    // Check database connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);
    
    // Checking if user exists 
    const adminExist = await Admin.findOne({ email });

    // Finding user by email
    Admin.find({ email })
      .then((data) => {
        if (data.length) {
          
          // User exists
          const hashedPassword = data[0].password;
          // Compare password hashes
          bcrypt
            .compare(password, hashedPassword)
            .then((result) => {
              if (result) {
                // Password match
                // Update admin status to true
                adminExist.status = true;
                adminExist.save();

                // Generate JWT token for authentication
                const JWTToken = generateJwtToken()
               
                // Respond with success message and user details
                res.status(200).json({
                  status: "SUCCESS",
                  message: "Valid User Credentials",
                  data:{
                    JWTToken:JWTToken,
                    name:data[0]?.name,
                    organization:data[0]?.organization,
                    email:data[0]?.email
                  }
                });
              } else {
                // Incorrect password
                res.json({
                  status: "FAILED",
                  message: "Invalid password entered!",
                });
              }
            })
            .catch((err) => {
              // Error occurred while comparing passwords
              res.json({
                status: "FAILED",
                message: "An error occurred while comparing passwords",
              });
            });
          
        } else {
          // User with provided email not found
          res.json({
            status: "FAILED",
            message: "Invalid credentials entered!",
          });
        }
      })
      .catch((err) => {
        // Error occurred during login process
        res.json({
          status: "FAILED",
          message: "An error occurred while checking for existing user",
        });
      });
  }
};

/**
 * API call for Admin Logout.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const logout = async (req, res) => {
  let { email } = req.body;
  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);

    // Checking if Admin already exists
    const existingAdmin = await Admin.findOne({ email });
    
     // If admin doesn't exist, or if they are not logged in, return failure response
     if (!existingAdmin) {
      return res.json({
        status: 'FAILED',
        message: 'Admin not found (or) Not Logged in!',
      });

    }

    // Save logout details by updating admin status to false
    existingAdmin.status = false;
    existingAdmin.save();

    // Respond with success message upon successful logout
    res.json({
        status: "SUCCESS",
        message: "Admin Logged out successfully"
     });

  } catch (error) {
    // Error occurred during logout process, respond with failure message
    res.json({
      status: 'FAILED',
      message: 'An error occurred during the logout!',
    });
  }
};

/**
 * API call for Reset Admin Password.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const resetPassword = async (req, res) => {
  let { email, password } = req.body;
  try {
    // Check database connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);
    
    // Find admin by email
    const admin = await Admin.findOne({ email });

    // If admin doesn't exist, return failure response
    if (!admin) {
      return res.json({
        status: 'FAILED',
        message: 'Admin not found',
      });
    }
    // Hash the new password
    const saltRounds = 10;
            bcrypt
              .hash(password, saltRounds)
              .then((hashedPassword) => {
                // Save hashed password to admin document
                admin.password = hashedPassword;
                // Save the admin document
                admin
                  .save()
                  .then(() => {
                    // Password reset successful, respond with success message
                    res.json({
                      status: "SUCCESS",
                      message: "Password reset successful"
                    });
                  })
                  .catch((err) => {
                    // Error occurred while saving user account, respond with failure message
                    res.json({
                      status: "FAILED",
                      message: "An error occurred while saving user account!",
                    });
                  });
              })
              .catch((err) => {
                // Error occurred while hashing password, respond with failure message
                res.json({
                  status: "FAILED",
                  message: "An error occurred while hashing password!",
                });
              });

  } catch (error) {
    // Error occurred during password reset process, respond with failure message
    res.json({
      status: 'FAILED',
      message: 'An error occurred during password reset process!',
    });
  }
};

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
      message: 'All user details fetched successfully'
    });
  } catch (error) {
    // Error occurred while fetching user details, respond with failure message
    res.json({
      status: 'FAILED',
      message: 'An error occurred while fetching user details'
    });
  }
};

/**
 * API to approve or reject Issuer status.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const validateIssuer = async (req, res) => {
  let validationStatus = req.body.status;
  let email = req.body.email;

  // Find user by email
  const userExist = await User.findOne({ email });

  if(!email || !userExist || (validationStatus !== 1 && validationStatus !== 2)) {
    var defaultMessage = "Invalid Input parameter";

    if((validationStatus !== 1 && validationStatus !== 2)) {
      var defaultMessage = "Invalid Issuer status";
    } else if (!userExist) {
      var defaultMessage = "User not found!";
    }
    return res.status(400).json({status: "FAILED", message: defaultMessage});
  }

  try {
    // Check mongo DB connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);

    const roleStatus = await new_contract.hasRole(process.env.ISSUER_ROLE, userExist.id);

    if(validationStatus == 1) {

      if((userExist.status == validationStatus) && (roleStatus == true)){
        res.status(400).json({status: "FAILED", message: "Existed Verified Issuer"});
      }

      var grantedStatus;
      if(roleStatus === false){
        try {
            var tx = await new_contract.grantRole(process.env.ISSUER_ROLE, userExist.id);
            grantedStatus = "SUCCESS";

            // Save verification details
            userExist.approved = true;
            userExist.status = 1;
            userExist.rejectedDate = null;
            await userExist.save();

            // If user is not approved yet, send email and update user's approved status
            var mailStatus = await sendEmail(userExist.name, email);
            var mailresponse = (mailStatus === true) ? "sent" : "NA";

            // Respond with success message indicating user approval
            res.json({
                status: "SUCCESS",
                email: mailresponse,
                grant: grantedStatus,
                message: "User Approved successfully"
            });
        } catch (error) {
          // Handle the error During the transaction
          console.error('Error occurred during grant Issuer role:', error.message);
          grantedStatus = "FAILED";
        }
      }

    } else if (validationStatus == 2) {
      
      if((userExist.status == validationStatus) && (roleStatus == false)){
        res.status(400).json({status: "FAILED", message: "Existed Rejected Issuer"});
      }

      var revokedStatus;
      if(roleStatus === true){
        try{
          var tx = await new_contract.revokeRole(process.env.ISSUER_ROLE, userExist.id);
          revokedStatus = "SUCCESS";

          // Save Issuer rejected details
          userExist.approved = false;
          userExist.status = 2;
          userExist.rejectedDate = Date.now();
          await userExist.save();
          
          // If user is not rejected yet, send email and update user's rejected status
          var mailStatus = await rejectEmail(userExist.name, email);
          var mailresponse = (mailStatus === true) ? "sent" : "NA";
          
          // Respond with success message indicating user rejected
          res.json({
              status: "SUCCESS",
              email: mailresponse,
              revoke: revokedStatus,
              message: "User Rejected successfully"
      });
        } catch (error) {
          // Handle the error During the transaction
          console.error('Error occurred during revoke Issuer role:', error.message);
          revokedStatus = "FAILED";
        }
     }
    }   
  } catch (error) {
    // Error occurred during user approval process, respond with failure message
    res.json({
      status: 'FAILED',
      message: "An error occurred during the Issuer validation process!",
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
  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);
 
    const { email } = req.body;
 
    const issuer = await User.findOne({ email: email }).select('-password');
 
    if (issuer) {
      res.json({
        status: 'SUCCESS',
        data: issuer,
        message: `Issuer with email ${email} fetched successfully`
      });
    } else {
      res.json({
        status: 'FAILED',
        message: `Issuer with email ${email} not found`
      });
    }
  } catch (error) {
    res.json({
      status: 'FAILED',
      message: 'An error occurred while fetching issuer details by email'
    });
  }
}

/**
 * API to Grant Issuer/Owner Role to an Address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const addTrustedOwner = async (req, res) => {

      // const { newOwnerAddress } = req.body;
  try {
    // Extract new wallet address from request body
    const assignRole = 1;
    const newAddress = req.body.address;

    // Validate Ethereum address format
    if (!ethers.isAddress(newAddress)) {
      return res.status(400).json({ status: "FAILED", message: "Invalid Ethereum address format" });
    }

    if(assignRole == 0 || assignRole == 1 ){

      const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

      // Blockchain processing.
      const response = await new_contract.hasRole(assigningRole, newAddress);
      
      if(response === true){
        // Simulation failed, send failure response
        return res.status(400).json({ status: "FAILED", message: "Address Existed in the Blockchain" });
      }
        
      try{
        const tx = await new_contract.grantRole(assigningRole, newAddress);
        var txHash = tx.hash;
        const messageInfo = (assignRole == 0) ? "Admin Role Granted" : "Issuer Role Granted";

        // Prepare success response
        const responseMessage = {
          status: "SUCCESS",
          message: messageInfo,
          details: `https://${process.env.NETWORK}.com/tx/${txHash}`
        };

        // Send success response
        res.status(200).json(responseMessage);
       
      } catch (error) {
        // Handle the error During the transaction
        console.error('Error occurred during grant Issuer role:', error.message);
      }

    }

  } catch (error) {
    // Internal server error occurred, send failure response
    console.error(error);
    res.status(500).json({ status: "FAILED", message: "Internal Server Error" });
  }
};

/**
 * API to Revoke Issuer/Owner Role from the Address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const removeTrustedOwner = async (req, res) => {

    // const { newOwnerAddress } = req.body;
try {
  // Extract new wallet address from request body
  const assignRole = 1;
  const newAddress = req.body.address;

  // Check if the target address is a valid Ethereum address
  if (!ethers.isAddress(newAddress)) {
    return res.status(400).json({ status: "FAILED", message: "Invalid Ethereum address format" });
  }  

  if(assignRole == 0 || assignRole == 1 ){

    const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

    // Blockchain processing.
    const response = await new_contract.hasRole(assigningRole, newAddress);

    if(response === false){
      // Simulation failed, send failure response
      return res.status(400).json({ status: "FAILED", message: "Address Doesn't Existed in the Blockchain" });
    } 

    try{
      const tx = await new_contract.revokeRole(assigningRole ,newAddress);
      
      var txHash = tx.hash;

      const messageInfo = (assignRole == 0) ? "Admin Role Revoked" : "Issuer Role Revoked";

      // Prepare success response
      const responseMessage = {
        status: "SUCCESS",
        message: messageInfo,
        details: `https://${process.env.NETWORK}.com/tx/${txHash}`
      };
      // Send success response
      res.status(200).json(responseMessage);
    } catch (error) {
      // Handle the error During the transaction
      console.error('Error occurred during revoke Issuer role:', error.message);
    }
  }
  } catch (error) {
    // Internal server error occurred, send failure response
    console.error(error);
    res.status(500).json({ status: "FAILED", message: "Internal Server Error" });
  }
};

/**
 * API to Check the balance of an Ethereum account address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const checkBalance = async (req, res) => {
 
  try {
      // Extract the target address from the query parameter
      const targetAddress = req.query.address;

      // Check if the target address is a valid Ethereum address
      if (!ethers.isAddress(targetAddress)) {
          return res.status(400).json({ status: "FAILED", message: "Invalid Ethereum address format" });
      }

    // Get the balance of the target address in Wei
    const balanceWei = await fallbackProvider.getBalance(targetAddress);

    // Convert balance from Wei to Ether
    const balanceEther = ethers.formatEther(balanceWei);
    
    // Convert balanceEther to fixed number of decimals (e.g., 2 decimals)
    const fixedDecimals = parseFloat(balanceEther).toFixed(3);

    // Prepare balance response
    const balanceResponse = {
          message: "Balance check successful",
          balance: fixedDecimals,
      };

      // Respond with the balance information
      res.status(200).json(balanceResponse);
  } catch (error) {
      // Handle errors
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
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
    res.status(200).send({status: "SUCCESS", message: 'File uploaded successfully', fileUrl: data.Location });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).send({status: "FAILED", error: 'An error occurred while uploading the file' });
  }
};

/**
 * API to do Health Check.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const healthCheck = async (req, res) => {
  // Perform checks on the API, such as database connectivity and response times
  const checks = [
    {
      name: 'Database connectivity',
      check: async () => {
        // Try to connect to the database
        const connection = await isDBConnected();
        // If the connection is successful, return true
        if (connection) {
          return true;
        }
        // Otherwise, return false
        return false;
      },
    },
    {
      name: 'Response',
      check: async () => {
        const healthcheck = {
            uptime: process.uptime(),
            message: 'OK',
            timestamp: Date.now()
        };
        try {
            // res.send(healthcheck);
            return true;
        } catch (error) {
            // healthcheck.message = error;
            return false;
            // res.status(503).send();
        }
      },
    },
  ];

  // Iterate over the checks and return an error if any of them fail
    for (const check of checks) {
      const result = await check.check();
      if (!result) {
        return res.status(500).send({status: "FAILED", message: `Health check failed: ${check.name}`});
      }
    }
  
  // If all of the checks pass, return a success response
  return res.status(200).send({status: "SUCCESS", message: 'API is healthy'});
};

module.exports = {
  // Function to issue a PDF certificate
  issuePdf,

  // Function to issue a certificate
  issue,

  // Function to issue a Batch of certificates
  batchCertificateIssue,

  // Function to generate a Polygon link for a certificate
  polygonLink,

  // Function to verify a certificate with a PDF QR code
  verify,

  // Function to verify a certificate with an ID
  verifyWithId,

  // Function to verify a Batch certificate with an ID
  verifyBatchCertificate,

  // Function to verify a Single/Batch certification with an ID
  verifyCertificationId,

  // Function to handle admin signup
  signup,

  // Function to handle admin login
  login,

  // Function to handle admin logout
  logout,

  // Function to reset admin password
  resetPassword,

  // Function to get all issuers (users)
  getAllIssuers,

  // Function to Approve or Reject the Issuer
  validateIssuer,

  // Function to grant role to an address
  addTrustedOwner,

  // Function to revoke role from the address
  removeTrustedOwner,

  // Function to check the balance of an Ethereum address
  checkBalance,

  // Function to fetch issuer details
  getIssuerByEmail,

  // Function to decode a certificate
  decodeCertificate,

  // Function to Upload Files to AWS-S3 bucket
  uploadFileToS3,

  // Function to do Health Check
  healthCheck
};
