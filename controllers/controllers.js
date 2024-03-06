// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require("express");
const app = express(); // Create an instance of the Express application
const path = require("path");
const QRCode = require("qrcode");
const fs = require("fs");
const _fs = require("fs-extra");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

// Import custom cryptoFunction module for encryption and decryption
const { decryptData, generateEncryptedUrl } = require("../common/cryptoFunction");
// Import custom authUtils module for JWT token generation
const { generateJwtToken } = require("../common/authUtils");

// Import Web3 library for interacting with the Ethereum blockchain
const Web3 = require('web3');

// Import MongoDB models
const { Admin, User, Issues, BatchIssues } = require("../config/schema");

// Import bcrypt for hashing passwords
const bcrypt = require("bcrypt");

// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH);
const max_length = parseInt(process.env.MAX_LENGTH);

// Importing functions from a custom module
const {
  fetchExcelRecord,
  insertCertificateData, // Function to insert certificate data into the database
  insertBatchCertificateData, // Function to insert Batch certificate data into the database
  findRepetitiveIdNumbers,
  extractQRCodeDataFromPDF, // Function to extract QR code data from a PDF file
  addLinkToPdf, // Function to add a link to a PDF file
  calculateHash, // Function to calculate the hash of a file
  web3i, // Instance of Web3 for interacting with Ethereum
  confirm, // Function to confirm a certificate
  simulateIssueCertificate, // Function to simulate issuing a certificate
  simulateIssueBatchCertificates, // Function to simulate issuing a Batch of certificate
  simulateRoleToAddress, // Function to simulate a grant / revoke role to an address
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected, // Function to check if the database connection is established
  sendEmail, // Function to send an email on approved
  rejectEmail // Function to send an email on rejected
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

let linkUrl; // Variable to store a link URL
let detailsQR; // Variable to store details of a QR code


app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API call for Certificate issue with pdf template
const issuePdf = async (req, res) => {
  // Extracting required data from the request body
  const email = req.body.email;
  const Certificate_Number = req.body.certificateNumber;
  const name = req.body.name;
  const courseName = req.body.course;
  const Grant_Date = req.body.grantDate;
  const Expiration_Date = req.body.expirationDate;

  // Check if user with provided email exists
  const idExist = await User.findOne({ email });
  // Check if certificate number already exists
  const isNumberExist = await Issues.findOne({ certificateNumber: Certificate_Number });
  // Check if certificate number already exists in the Batch
  const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: Certificate_Number });

  // Validation checks for request data
  if (
    (!idExist || idExist.status !== 1)|| // User does not exist
    // !idExist ||
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
    }else if (!Certificate_Number) {
      errorMessage = "Certification number is required";
    } else if (Certificate_Number.length > max_length) {
      errorMessage = `Certification number should be less than ${max_length} characters`;
    } else if (Certificate_Number.length < min_length) {
      errorMessage = `Certification number should be at least ${min_length} characters`;
    } else if (!idExist) {
      errorMessage = `Invalid Issuer Email`;
    } else if(idExist.status !== 1) {
      errorMessage = `Unauthorised Issuer Email`;
  }

    // Respond with error message
    res.status(400).json({ message: errorMessage });
    return;
  } else {
    // If validation passes, proceed with certificate issuance
    const fields = {
    Certificate_Number: req.body.certificateNumber,
    name: req.body.name,
    courseName: req.body.course,
    Grant_Date: req.body.grantDate,
    Expiration_Date: req.body.expirationDate,
  };
  const hashedFields = {};
  for (const field in fields) {
    hashedFields[field] = calculateHash(fields[field]);
  }
  const combinedHash = calculateHash(JSON.stringify(hashedFields));

  //Blockchain processing.
  const contract = await web3i();    

      // Verify certificate on blockchain
      const isPaused = await contract.methods.paused().call();
      const issuerAuthorized = await contract.methods.hasRole(process.env.ISSUER_ROLE, idExist.id).call();
      const val = await contract.methods.verifyCertificateById(Certificate_Number).call();

      if (
        val === true || 
        isPaused === true
        ) {
        // Certificate already issued / contract paused
        var messageContent = "Certification already issued";
        if(isPaused === true) {
          messageContent = "Operation restricted by the Blockchain";
        // } else if (issuerAuthorized === false) {
        //   messageContent = "Unauthorized Issuer to perform operation in Blockchain";
        }
        res.status(400).json({ message: messageContent });
      } 
      else {
        // Simulate issuing the certificate
        const simulateIssue = await simulateIssueCertificate(Certificate_Number, combinedHash);
      if (simulateIssue) { 
        // If simulation successful, issue the certificate on blockchain
        const tx = contract.methods.issueCertificate(
          fields.Certificate_Number,
          combinedHash
        );
        const hash = await confirm(tx);

      // Generate link URL for the certificate on blockchain
      const linkUrl = `https://${process.env.NETWORK}.com/tx/${hash}`;

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
          // __dirname + "/" + file,
          path.join(__dirname, '..', file),
          outputPdf,
          linkUrl,
          qrCodeImage,
          combinedHash
        );
    
        // Read the generated PDF file
        const fileBuffer = fs.readFileSync(outputPdf);

        try {
          // Check mongoose connection
          const dbState = await isDBConnected();
          if (dbState === false) {
            console.error("Database connection is not ready");
          } else {
            console.log("Database connection is ready");
          }

          // Insert certificate data into database
          const id = idExist.id;
          const certificateData = {
            id,
            transactionHash: hash,
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
      else {
        // Simulation for issuing certificate failed
        res.status(400).json({ message: "Simulation for the IssueCertificate failed" });
      }
    }
  }
};

// API call for Certificate issue without pdf template
const issue = async (req, res) => {
  // Extracting required data from the request body
  const email = req.body.email;
  const Certificate_Number = req.body.certificateNumber;
  const name = req.body.name;
  const courseName = req.body.course;
  const Grant_Date = req.body.grantDate;
  const Expiration_Date = req.body.expirationDate;

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
      res.status(400).json({ message: errorMessage });
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

      // Blockchain processing.
      const contract = await web3i();

      // Verify certificate on blockchain
      const isPaused = await contract.methods.paused().call();
      const issuerAuthorized = await contract.methods.hasRole(process.env.ISSUER_ROLE, idExist.id).call();
      const val = await contract.methods.verifyCertificateById(Certificate_Number).call();

      if (
        val === true || 
        isPaused === true
        ) {
        // Certificate already issued / contract paused
        var messageContent = "Certification already issued";
        if(isPaused === true) {
          messageContent = "Operation restricted by the Blockchain";
        // } else if (issuerAuthorized === false) {
        //   messageContent = "Unauthorized Issuer to perform operation in Blockchain";
        }
        res.status(400).json({ message: messageContent });
      }else {
        // Simulate issuing the certificate
        const simulateIssue = await simulateIssueCertificate(Certificate_Number, combinedHash);
        if (simulateIssue) {
          // If simulation successful, issue the certificate on blockchain
          const tx = contract.methods.issueCertificate(
            Certificate_Number,
            combinedHash
          );

          hash = await confirm(tx);

      // Generate link URL for the certificate on blockchain
      const polygonLink = `https://${process.env.NETWORK}.com/tx/${hash}`;

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
          const dbState = await isDBConnected();
          if (dbState === false) {
            console.error("Database connection is not ready");
          } else {
            console.log("Database connection is ready");
          }

          const id = idExist.id;

          var certificateData = {
            id,
            transactionHash: hash,
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
        else {
          // Simulation for issuing certificate failed
          res.status(400).json({ message: "Simulation for the IssueCertificate failed" });
        }
      }

    } catch (error) {
       // Internal server error
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
};

// API call for Batch Certificates issue 
const batchCertificateIssue = async (req, res) => {
  const email = req.body.email;
  
  file = req.file.path;

  const idExist = await User.findOne({ email });

  var filePath = req.file.path;

  // Fetch the records from the Excel file
  const excelData = await fetchExcelRecord(filePath);

  await _fs.remove(filePath);

    if (
      // (!idExist || idExist.status !== 1)|| // User does not exist
      !idExist || 
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
    // } else if(idExist.status !== 1) {
    //   errorMessage = `Unauthorised Issuer Email`;
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

    // Initialize an empty list to store matching IDs
    const matchingIDs = [];

    const repetitiveNumbers = await findRepetitiveIdNumbers(certificationIDs);

    if(repetitiveNumbers.length > 0){
      res.status(400).json({ status: "FAILED", message: "Excel file has Repetition in Certification IDs", Details: repetitiveNumbers });
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

      // Blockchain processing.
      const contract = await web3i();

      // Verify on blockchain
      const isPaused = await contract.methods.paused().call();
      const issuerAuthorized = await contract.methods.hasRole(process.env.ISSUER_ROLE, idExist.id).call();
    
      if (isPaused === true) {
        // Certificate contract paused
        var messageContent = "Operation restricted by the Blockchain";

        // if(issuerAuthorized === flase) {
        //   messageContent = "Unauthorized Issuer to perform operation in Blockchain";
        // }
        
        res.status(400).json({ message: messageContent});
      } 
      
      // Generate the Merkle tree
      const tree = StandardMerkleTree.of(values, ['string']);

      const batchNumber = await contract.methods.getRootLength().call();
      const allocateBatchId = parseInt(batchNumber) + 1;
            
      const simulateIssue = await simulateIssueBatchCertificates(tree.root);
          
      if (simulateIssue) {
        const tx = contract.methods.issueBatchOfCertificates(
          tree.root
      );
      
        hash = await confirm(tx);

        const polygonLink = `https://${process.env.NETWORK}.com/tx/${hash}`;

      try {
        // Check mongoose connection
        const dbState = await isDBConnected();
        if (dbState === false) {
          console.error("Database connection is not ready");
        } else {
          console.log("Database connection is ready");
          }
          
          var batchDetails = [];
          for (var i = 0; i < certificatesCount; i++) {
            var _proof = tree.getProof(i);
            batchDetails[i] = {
                  id: idExist.id,
                  batchId: allocateBatchId,
                  proofHash: _proof,
                  transactionHash: hash,
                  certificateHash: hashedBatchData[i],
                  certificateNumber: rawBatchData[i].certificationID,
                  name: rawBatchData[i].name,
                  course: rawBatchData[i].certificationName,
                  grantDate: rawBatchData[i].grantDate,
                  expirationDate: rawBatchData[i].expirationDate
              }
              
            // console.log("Batch Certificate Details", batchDetails[i]);
              await insertBatchCertificateData(batchDetails[i]);
        }
        console.log("Data inserted");

        res.status(200).json({
          status: "SUCCESS",
          message: "Batch of Certifications issued successfully",
          polygonLink: "polygonLink",
          details: batchDetails,
        });

        await cleanUploadFolder();

        } catch (error) {
        // Handle mongoose connection error (log it, throw an error, etc.)
        console.error("Internal server error", error);
      }
      }
      else {
        res.status(400).json({ status: "FAILED", message: "Simulation failed for issue BatchCertifications" });
      }

  } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ status: 'FAILED', error: 'Internal Server Error.' });
  }
}
};

// Define a route that takes a hash parameter
const polygonLink = async (req, res) => {
  res.json({ linkUrl });
};

// Verify page with PDF QR - Blockchain URL
const verify = async (req, res) => {
  // Extracting file path from the request
  file = req.file.path;

  try {
    // Extract QR code data from the PDF file
    const certificateData = await extractQRCodeDataFromPDF(file);

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
      message: "Certificate is not valid"
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

// Verify certificate with ID
const verifyWithId = async (req, res) => {
  inputId = req.body.id;

  try {
    // Blockchain processing.
    const contract = await web3i();
    const response = await contract.methods.verifyCertificateById(inputId).call();

    if (response === true) {
      const certificateNumber = inputId;
    try {
          // Check mongoose connection
          const dbState = await isDBConnected();
          if (dbState === false) {
            console.error("Database connection is not ready");
          } else {
            console.log("Database connection is ready");
          }
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
      res.status(400).json({ status: "FAILED", message: "Certification doesn't exist" });
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

// API call for Batch Certificates verify with Certification ID
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
      const contract = await web3i();

      const val = await contract.methods.verifyCertificateInBatch(batchNumber, dataHash, proof).call();

      return res.status(val ? 200 : 400).json({ status: val ? 'SUCCESS' : 'FAILED', Message: val ? "Valid Certification ID" : 'Invalid Certification ID', details: val ? issueExist : 'NA' });
    
    } else {
        
    return res.status(400).json({ status: 'FAILED', error: 'Invalid Certification ID' });
    }
      }
  catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ status: 'FAILED', error: 'Internal Server Error.' });
  }
}; 

// API call for Batch Certificates verify with Certification ID
const verifyCertificationId = async (req, res) => {
  const inputId = req.body.id;
  const dbStaus = await isDBConnected();
  console.log("DB connected:", dbStaus);

  const singleIssueExist = await Issues.findOne({ certificateNumber : inputId });
  const batchIssueExist = await BatchIssues.findOne({ certificateNumber : inputId });

  // Blockchain processing.
  const contract = await web3i();
  const response = await contract.methods.verifyCertificateById(inputId).call();

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
    
    try {
      const foundCertification = (singleIssueExist != null) ? singleIssueExist : inputId;
      const verificationResponse = {
        status: "SUCCESS",
        message: "Valid Certification",
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
      const contract = await web3i();

      const val = await contract.methods.verifyCertificateInBatch(batchNumber, dataHash, proof).call();

      if (val === true) {
        try {
    
          const _verificationResponse = {
            status: "SUCCESS",
            message: "Valid Certification",
            details: batchIssueExist
          };
          res.status(200).json(_verificationResponse);
          
          }catch (error) {
            res.status(500).json({ status: 'FAILED', message: 'Internal Server Error.' });
          }
        } else {
          res.status(400).json({ status: "FAILED", message: "Certification doesn't exist" });
        }
    } 
  }

}; 

// Admin Signup
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
      const dbState = await isDBConnected();
      if (dbState === false) {
        console.error("Database connection is not ready");
      } else {
        console.log("Database connection is ready");
      }
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

// Admin Login
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
      const dbState = await isDBConnected();
      if (dbState === false) {
        console.error("Database connection is not ready");
      } else {
        console.log("Database connection is ready");
    }
    
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

const logout = async (req, res) => {
  let { email } = req.body;
  try {
    // Check mongoose connection
      const dbState = await isDBConnected();
      if (dbState === false) {
        console.error("Database connection is not ready");
      } else {
        console.log("Database connection is ready");
      }
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

// Reset Admin Password
const resetPassword = async (req, res) => {
  let { email, password } = req.body;
  try {
    // Check database connection
      const dbState = await isDBConnected();
      if (dbState === false) {
        console.error("Database connection is not ready");
      } else {
        console.log("Database connection is ready");
    }
    
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

const getAllIssuers = async (req, res) => {
  try {
    // Check mongoose connection
      const dbState = await isDBConnected();
      if (dbState === false) {
        console.error("Database connection is not ready");
      } else {
        console.log("Database connection is ready");
    }
    
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

// Approve or Reject the Issuer
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
    // Check mongoose connection
      const dbState = await isDBConnected();
      if (dbState === false) {
        console.error("Database connection is not ready");
      } else {
        console.log("Database connection is ready");
    }

    if(validationStatus == 1) {
      // If user is not approved yet, send email and update user's approved status
      var mailStatus = await sendEmail(userExist.name, email);
      var mailresponse = (mailStatus === true) ? "sent" : "NA";

      // Save verification details
      userExist.approved = true;
      userExist.status = 1;
      userExist.rejectedDate = null;
      await userExist.save();
      
      // Respond with success message indicating user approval
      res.json({
          status: "SUCCESS",
          email: mailresponse,
          message: "User Approved successfully"
      });

    } else if (validationStatus == 2) {
      // If user is not approved yet, send email and update user's approved status
      var mailStatus = await rejectEmail(userExist.name, email);
      var mailresponse = (mailStatus === true) ? "sent" : "NA";

      // Save Issuer rejected details
      userExist.approved = false;
      userExist.status = 2;
      userExist.rejectedDate = Date.now();
      await userExist.save();
      
      // Respond with success message indicating user approval
      res.json({
          status: "SUCCESS",
          email: mailresponse,
          message: "User Rejected successfully"
      });

    }   
  } catch (error) {
    // Error occurred during user approval process, respond with failure message
    res.json({
      status: 'FAILED',
      message: "An error occurred during the Issuer validation process!",
    });
  }
};

// Function to fetch details of Issuer
const getIssuerByEmail = async (req, res) => {
  try {
    // Check mongoose connection
    const dbState = await isDBConnected();
    if (dbState === false) {
      console.error("Database connection is not ready");
    } else {
      console.log("Database connection is ready");
    }
 
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

// Grant Issuer/Owner Role to an Address
const addTrustedOwner = async (req, res) => {
    // Initialize Web3 instance with RPC endpoint
    const web3 = await new Web3(
      new Web3.providers.HttpProvider(
        process.env.RPC_ENDPOINT
      )
    );

      // const { newOwnerAddress } = req.body;
  try {
    // Extract new wallet address from request body
    const assignRole = 1;
    const newAddress = req.body.address;

    // Validate Ethereum address format
    if (!web3.utils.isAddress(newAddress)) {
      return res.status(400).json({ message: "Invalid Ethereum address format" });
    }

    var contract = await web3i();

    if(assignRole == 0 || assignRole == 1 ){

      const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

      // Blockchain processing.
      const response = await contract.methods.hasRole(assigningRole, newAddress).call();
      
      if(response === true){
        // Simulation failed, send failure response
        return res.status(400).json({ status: "FAILED", message: "Address Existed in the Blockchain" });
      } else if(response === false) {
        // Simulate grant Admin role
        const simulateGrantRole = await simulateRoleToAddress("grant", assigningRole, newAddress);

      // If simulation successful, proceed to grant role to the Address
      if (simulateGrantRole) {

        // Prepare transaction to add trusted owner
        const tx = contract.methods.grantRole(assigningRole ,newAddress);

        // Confirm transaction
        const hash = await confirm(tx);

        const messageInfo = (assignRole == 0) ? "Admin Role Granted" : "Issuer Role Granted";

        // Prepare success response
        const responseMessage = {
          status: "SUCCESS",
          message: messageInfo,
          details: `https://${process.env.NETWORK}.com/tx/${hash}`
        };

        // Send success response
        res.status(200).json(responseMessage);
      } else {
        // Simulation failed, send failure response
        return res.status(400).json({ status: "FAILED", message: "Simulation failed" });
      }

      } else {
        return res.status(500).json({ status: "FAILED", message: "Internal Server Error" });
      }

    } else{
      return res.status(400).json({ status: "FAILED", message: "Invalid Role assigned" });
    }

  } catch (error) {
    // Internal server error occurred, send failure response
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Revoke Issuer/Owner Role from the Address
const removeTrustedOwner = async (req, res) => {
  // Initialize Web3 instance with RPC endpoint
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      process.env.RPC_ENDPOINT
    )
  );

    // const { newOwnerAddress } = req.body;
try {
  // Extract new wallet address from request body
  const assignRole = 1;
  const newAddress = req.body.address;

  // Validate Ethereum address format
  if (!web3.utils.isAddress(newAddress)) {
    return res.status(400).json({ message: "Invalid Ethereum address format" });
  }

  var contract = await web3i();

  if(assignRole == 0 || assignRole == 1 ){

    const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

    // Blockchain processing.
    const response = await contract.methods.hasRole(assigningRole, newAddress).call();
    console.log("The role response", response);
    
    if(response === false){
      // Simulation failed, send failure response
      return res.status(400).json({ status: "FAILED", message: "Address Doesn't Existed in the Blockchain" });
    } else if(response === true) {
      // Simulate grant Admin role
      const simulateGrantRole = await simulateRoleToAddress("revoke", assigningRole, newAddress);

    // If simulation successful, proceed to grant role to the Address
    if (simulateGrantRole) {

      // Prepare transaction to add trusted owner
      const tx = contract.methods.revokeRole(assigningRole ,newAddress);

      // Confirm transaction
      const hash = await confirm(tx);

      const messageInfo = (assignRole == 0) ? "Admin Role Revoked" : "Issuer Role Revoked";

      // Prepare success response
      const responseMessage = {
        status: "SUCCESS",
        message: messageInfo,
        details: `https://${process.env.NETWORK}.com/tx/${hash}`
      };

      // Send success response
      res.status(200).json(responseMessage);
    } else {
      // Simulation failed, send failure response
      return res.status(400).json({ status: "FAILED", message: "Simulation failed" });
    }

    } else {
      return res.status(500).json({ status: "FAILED", message: "Internal Server Error" });
    }

  } else{
    return res.status(400).json({ status: "FAILED", message: "Invalid Role assigned" });
  }

} catch (error) {
  // Internal server error occurred, send failure response
  console.error(error);
  res.status(500).json({ message: "Internal Server Error" });
}
};

// Check Balance
const checkBalance = async (req, res) => {
  // Initialize Web3 instance with RPC endpoint
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      process.env.RPC_ENDPOINT
    )
  );
  try {
      // Extract the target address from the query parameter
      const targetAddress = req.query.address;

      // Check if the target address is a valid Ethereum address
      if (!web3.utils.isAddress(targetAddress)) {
          return res.status(400).json({ message: "Invalid Ethereum address format" });
      }

    // Get the balance of the target address in Wei
    const balanceWei = await web3.eth.getBalance(targetAddress);

    // Convert balance from Wei to Ether
    const balanceEther = web3.utils.fromWei(balanceWei, 'ether');
    
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
  decodeCertificate
};
