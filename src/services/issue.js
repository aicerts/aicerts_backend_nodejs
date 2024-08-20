// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const path = require("path");
const QRCode = require("qrcode");
const fs = require("fs");
const { fromBuffer, fromBase64 } = require("pdf2pic");
const { ethers } = require("ethers"); // Ethereum JavaScript library
const AWS = require('../config/aws-config');
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../common/cryptoFunction");

// Import MongoDB models
const { User, DynamicIssues, DynamicParameters } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

const bulkIssueStatus = process.env.BULK_ISSUE_STATUS || 'DEFAULT';

// Importing functions from a custom module
const {
  convertDateFormat,
  convertDateToEpoch,
  convertEpochToDate,
  holdExecution,
  insertCertificateData, // Function to insert certificate data into the database
  insertDynamicCertificateData,
  addDynamicLinkToPdf,
  insertBulkSingleIssueData,
  insertBulkBatchIssueData,
  addLinkToPdf, // Function to add a link to a PDF file
  verifyPDFDimensions, //Verify the uploading pdf template dimensions
  verifyDynamicPDFDimensions,
  calculateHash, // Function to calculate the hash of a file
  cleanUploadFolder, // Function to clean up the upload folder
  isDBConnected, // Function to check if the database connection is established
  insertUrlData,
  getCertificationStatus,
  isCertificationIdExisted,
  checkForPngFiles,
  deletePngFiles,
  getContractAddress,
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

// const { convertPdfBufferToPng, _convertPdfBufferToPng } = require('../utils/generateImage');

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

// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH);
const max_length = parseInt(process.env.MAX_LENGTH);

const messageCode = require("../common/codes");
const rootDirectory = path.join(__dirname, '../../');

const handleIssueCertification = async (email, certificateNumber, name, courseName, _grantDate, _expirationDate) => {
  const grantDate = await convertDateFormat(_grantDate);
  const expirationDate = await convertDateFormat(_expirationDate);
  // Get today's date
  let today = new Date(); // Adjust timeZone as per the US Standard Time zone
  // Convert today's date to epoch time (in milliseconds)
  let todayEpoch = today.getTime() / 1000; // Convert milliseconds to seconds

  const epochGrant = await convertDateToEpoch(grantDate);
  const epochExpiration = expirationDate != 1 ? await convertDateToEpoch(expirationDate) : 1;
  const validExpiration = todayEpoch + (32 * 24 * 60 * 60); // Add 32 days (30 * 24 hours * 60 minutes * 60 seconds);

  if (
    !grantDate ||
    !expirationDate ||
    (epochExpiration != 1 && epochGrant > epochExpiration) ||
    (epochExpiration != 1 && epochExpiration < validExpiration)
  ) {
    let errorMessage = messageCode.msgInvalidDate;
    if (!grantDate || !expirationDate) {
      errorMessage = messageCode.msgInvalidDateFormat;
    } else if (epochExpiration != 1 && epochGrant > epochExpiration) {
      errorMessage = messageCode.msgOlderGrantDate;
    } else if (epochExpiration != 1 && epochExpiration < validExpiration) {
      errorMessage = `${expirationDate} - ${messageCode.msgInvalidExpiration}`;
    }
    return ({ code: 400, status: "FAILED", message: errorMessage });
  }
  try {
    await isDBConnected();
    // Check if user with provided email exists
    const idExist = await User.findOne({ email });
    // Check if certificate number already exists
    const isIssueExist = await isCertificationIdExisted(certificateNumber);
    // Validation checks for request data
    if (
      (!idExist || idExist.status !== 1) || // User does not exist
      // !idExist || // User does not exist
      isIssueExist || // Certificate number already exists 
      !certificateNumber || // Missing certificate number
      !name || // Missing name
      !courseName || // Missing course name
      (!grantDate || grantDate == 'Invalid date') || // Missing grant date
      (!expirationDate || expirationDate == 'Invalid date') || // Missing expiration date
      [certificateNumber, name, courseName, grantDate].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
      certificateNumber.length > max_length || // Certificate number exceeds maximum length
      certificateNumber.length < min_length // Certificate number is shorter than minimum length
    ) {
      // Prepare error message
      let errorMessage = messageCode.msgPlsEnterValid;
      let moreDetails = '';
      // Check for specific error conditions and update the error message accordingly
      if (isIssueExist) {
        errorMessage = messageCode.msgCertIssued;
        let _certStatus = await getCertificationStatus(isIssueExist.certificateStatus);
        moreDetails = { certificateNumber: isIssueExist.certificateNumber, expirationDate: isIssueExist.expirationDate, certificateStatus: _certStatus };
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
      return ({ code: 400, status: "FAILED", message: errorMessage, details: moreDetails });
    } else {
      if (expirationDate != 1) {
        if (expirationDate == grantDate) {
          // Respond with error message
          return ({ code: 400, status: "FAILED", message: `${messageCode.msgDatesMustNotSame} : ${grantDate}, ${expirationDate}` });
        }
      }
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
          let getContractStatus = await getContractAddress();
          if (!getContractStatus) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: messageCode.msgRpcFailed });
          }
          // Verify certificate on blockchain
          const isPaused = await newContract.paused();
          // Check if the Issuer wallet address is a valid Ethereum address
          if (!ethers.isAddress(idExist.issuerId)) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidEthereum });
          }
          const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
          const val = await newContract.verifyCertificateById(certificateNumber);
          if (
            val[0] === true ||
            isPaused === true ||
            issuerAuthorized === false
          ) {
            // Certificate already issued / contract paused
            let messageContent = messageCode.msgCertIssued;
            let modifiedDate = val[1] == 1 ? 'infinite expiration' : await convertEpochToDate(val[1]);
            let _certificateStatus = await getCertificationStatus(val[3]);
            let moreDetails = val[0] === true ? { certificateNumber: certificateNumber, expirationDate: modifiedDate, certificateStatus: _certificateStatus } : "";
            if (isPaused === true) {
              messageContent = messageCode.msgOpsRestricted;
            } else if (issuerAuthorized === false) {
              messageContent = messageCode.msgIssuerUnauthrized;
            }
            return ({ code: 400, status: "FAILED", message: messageContent, details: moreDetails });

          } else {

            let { txHash, polygonLink } = await issueCertificateWithRetry(certificateNumber, combinedHash, epochExpiration);
            if (!polygonLink || !txHash) {
              return ({ code: 400, status: false, message: messageCode.msgFailedToIssueAfterRetry, details: certificateNumber });
            }

            // Generate encrypted URL with certificate data
            const dataWithLink = { ...fields, polygonLink: polygonLink }
            const urlLink = generateEncryptedUrl(dataWithLink);
            let shortUrlStatus = false;
            let modifiedUrl = false;

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

            if (urlLink) {
              let dbStatus = await isDBConnected();
              if (dbStatus) {
                let urlData = {
                  email: email,
                  certificateNumber: certificateNumber,
                  url: urlLink
                }
                await insertUrlData(urlData);
                shortUrlStatus = true;
              }
            }

            if (shortUrlStatus) {
              modifiedUrl = process.env.SHORT_URL + certificateNumber;
            }

            const _qrCodeData = modifiedUrl != false ? modifiedUrl : qrCodeData;
            // console.log("Short URL", _qrCodeData);

            const qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
              errorCorrectionLevel: "H",
              width: 450, // Adjust the width as needed
              height: 450, // Adjust the height as needed
            });

            try {
              // Check mongoose connection
              const dbStatus = await isDBConnected();
              const dbStatusMessage = (dbStatus === true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
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
                expirationDate: fields.Expiration_Date,
                email: email,
                certStatus: 1,
                type: 'withoutpdf',
              };
              // Insert certificate data into database
              await insertCertificateData(certificateData);

            } catch (error) {
              // Handle mongoose connection error (log it, response an error, etc.)
              console.error(messageCode.msgInternalError, error);
              return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
            }

            // Respond with success message and certificate details
            return ({
              code: 200,
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
          return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
        }
      } catch (error) {
        // Internal server error
        console.error(error);
        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    // Internal server error
    console.error(error);
    return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }

};

const handleIssuePdfCertification = async (email, certificateNumber, name, courseName, _grantDate, _expirationDate, _pdfPath) => {
  const pdfPath = _pdfPath;
  const grantDate = await convertDateFormat(_grantDate);
  const expirationDate = await convertDateFormat(_expirationDate);
  // Get today's date
  const today = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }); // Adjust timeZone as per the US Standard Time zone
  // Convert today's date to epoch time (in milliseconds)
  const todayEpoch = new Date(today).getTime() / 1000; // Convert milliseconds to seconds

  const epochGrant = await convertDateToEpoch(grantDate);
  const epochExpiration = expirationDate != 1 ? await convertDateToEpoch(expirationDate) : 1;
  const validExpiration = todayEpoch + (32 * 24 * 60 * 60); // Add 32 days (30 * 24 hours * 60 minutes * 60 seconds);

  if (
    !grantDate ||
    !expirationDate ||
    (epochExpiration != 1 && epochGrant > epochExpiration) ||
    (epochExpiration != 1 && epochExpiration < validExpiration)
  ) {
    let errorMessage = messageCode.msgInvalidDate;
    if (!grantDate || !expirationDate) {
      errorMessage = messageCode.msgInvalidDateFormat;
    } else if (epochExpiration != 1 && epochGrant > epochExpiration) {
      errorMessage = messageCode.msgOlderGrantDate;
    } else if (epochExpiration != 1 && epochExpiration < validExpiration) {
      errorMessage = `${expirationDate} - ${messageCode.msgInvalidExpiration}`;
    }
    return ({ code: 400, status: "FAILED", message: errorMessage });
  }

  try {
    await isDBConnected();
    // Check if user with provided email exists
    const idExist = await User.findOne({ email });
    // Check if certificate number already exists
    const isIssueExist = await isCertificationIdExisted(certificateNumber);

    let _result = '';
    let templateData = await verifyPDFDimensions(pdfPath)
      .then(result => {
        _result = result;
      })
      .catch(error => {
        console.error("Error during verification:", error);
      });

    // Validation checks for request data
    if (
      (!idExist || idExist.status !== 1) || // User does not exist
      _result == false ||
      isIssueExist || // Certificate number already exists 
      !certificateNumber || // Missing certificate number
      !name || // Missing name
      !courseName || // Missing course name
      !grantDate || // Missing grant date
      !expirationDate || // Missing expiration date
      [certificateNumber, name, courseName, grantDate].some(value => typeof value !== 'string' || value == 'string') || // Some values are not strings
      certificateNumber.length > max_length || // Certificate number exceeds maximum length
      certificateNumber.length < min_length // Certificate number is shorter than minimum length
    ) {
      // res.status(400).json({ message: "Please provide valid details" });
      let errorMessage = messageCode.msgPlsEnterValid;
      let moreDetails = '';
      // Check for specific error conditions and update the error message accordingly
      if (isIssueExist) {
        errorMessage = messageCode.msgCertIssued;
        const _certStatus = await getCertificationStatus(isIssueExist.certificateStatus);
        moreDetails = { certificateNumber: isIssueExist.certificateNumber, expirationDate: isIssueExist.expirationDate, certificateStatus: _certStatus };
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
      } else if (_result == false) {
        await cleanUploadFolder();
        errorMessage = messageCode.msgInvalidPdfTemplate;
      }

      // Respond with error message
      return ({ code: 400, status: "FAILED", message: errorMessage, details: moreDetails });
    } else {
      if (expirationDate != 1) {
        if (expirationDate == grantDate) {
          // Respond with error message
          return ({ code: 400, status: "FAILED", message: `${messageCode.msgDatesMustNotSame} : ${grantDate}, ${expirationDate}` });
        }
      }
      // If validation passes, proceed with certificate issuance
      const fields = {
        Certificate_Number: certificateNumber,
        name: name,
        courseName: courseName,
        Grant_Date: grantDate,
        Expiration_Date: expirationDate,
      };
      const hashedFields = {};
      for (const field in fields) {
        hashedFields[field] = calculateHash(fields[field]);
      }
      const combinedHash = calculateHash(JSON.stringify(hashedFields));

      try {
        let getContractStatus = await getContractAddress();
        if (!getContractStatus) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: messageCode.msgRpcFailed });
        }
        // Verify certificate on blockchain
        let isPaused = await newContract.paused();
        // Check if the Issuer wallet address is a valid Ethereum address
        if (!ethers.isAddress(idExist.issuerId)) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidEthereum });
        }
        const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
        const val = await newContract.verifyCertificateById(certificateNumber);
        console.log("Issuer Authorized: ", issuerAuthorized);
        if (
          val[0] === true ||
          isPaused === true ||
          issuerAuthorized === false
        ) {
          // Certificate already issued / contract paused
          let messageContent = messageCode.msgCertIssued;
          let modifiedDate = val[1] == 1 ? 'infinite expiration' : await convertEpochToDate(val[1]);
          let _certificateStatus = await getCertificationStatus(val[3]);
          let moreDetails = val[0] === true ? { certificateNumber: certificateNumber, expirationDate: modifiedDate, certificateStatus: _certificateStatus } : "";

          if (isPaused === true) {
            messageContent = messageCode.msgOpsRestricted;
          } else if (issuerAuthorized === false) {
            messageContent = messageCode.msgIssuerUnauthrized;
          }
          return ({ code: 400, status: "FAILED", message: messageContent, details: moreDetails });
        }
      } catch (error) {
        // Handle mongoose connection error (log it, response an error, etc.)
        console.error("Internal server error", error);
        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }

      let { txHash, polygonLink } = await issueCertificateWithRetry(certificateNumber, combinedHash, epochExpiration);
      if (!polygonLink || !txHash) {
        return ({ code: 400, status: false, message: messageCode.msgFailedToIssueAfterRetry, details: certificateNumber });
      }

      try {
        // Generate encrypted URL with certificate data
        const dataWithLink = {
          ...fields, polygonLink: polygonLink
        }
        const urlLink = await generateEncryptedUrl(dataWithLink);
        const legacyQR = false;
        let shortUrlStatus = false;
        let modifiedUrl;

        let qrCodeData = '';
        if (legacyQR) {
          // Include additional data in QR code
          qrCodeData = `Verify On Blockchain: ${polygonLink},
            Certification Number: ${dataWithLink.Certificate_Number},
            Name: ${dataWithLink.name},
            Certification Name: ${dataWithLink.courseName},
            Grant Date: ${dataWithLink.Grant_Date},
            Expiration Date: ${dataWithLink.Expiration_Date}`;
        } else {
          // Directly include the URL in QR code
          qrCodeData = urlLink;
        }

        if (urlLink) {
          let dbStatus = await isDBConnected();
          if (dbStatus) {
            const urlData = {
              email: email,
              certificateNumber: certificateNumber,
              url: urlLink
            }
            await insertUrlData(urlData);
            shortUrlStatus = true;
          }
        }

        if (shortUrlStatus) {
          modifiedUrl = process.env.SHORT_URL + certificateNumber;
        }

        let _qrCodeData = modifiedUrl != false ? modifiedUrl : qrCodeData;
        // console.log("Short URL", _qrCodeData);

        const qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
          errorCorrectionLevel: "H", width: 450, height: 450
        });

        var file = pdfPath;
        var outputPdf = `${fields.Certificate_Number}${name}.pdf`;

        if (!fs.existsSync(pdfPath)) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidPdfUploaded });
        }

        // Add link and QR code to the PDF file
        const opdf = await addLinkToPdf(
          pdfPath,
          outputPdf,
          polygonLink,
          qrCodeImage,
          combinedHash
        );

        // Read the generated PDF file
        var fileBuffer = fs.readFileSync(outputPdf);

      } catch (error) {
        return ({ code: 400, status: "FAILED", message: messageCode.msgPdfError, details: error });
      }


      // Define the directory where you want to save the file
      const uploadDir = path.join(__dirname, '..', '..', 'uploads'); // Go up two directories from __dirname
      let _generatedImage = `${fields.Certificate_Number}.png`;
      var generatedImage = path.join(rootDirectory, _generatedImage);
      console.log("Image path", generatedImage);

      var imageBuffer = await convertPdfBufferToPngWithRetry(generatedImage, fileBuffer);
      if (imageBuffer) {
        var imageUrl = await uploadImageToS3(fields.Certificate_Number, generatedImage);
        if (!imageUrl) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgUploadError });
        }
      } else {
        return ({ code: 400, status: "FAILED", message: messageCode.msgImageError });
      }

      try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus === true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
        console.log(dbStatusMessage);

        // Insert certificate data into database
        const issuerId = idExist.issuerId;
        let certificateData = {
          issuerId,
          transactionHash: txHash,
          certificateHash: combinedHash,
          certificateNumber: fields.Certificate_Number,
          name: fields.name,
          course: fields.courseName,
          grantDate: fields.Grant_Date,
          expirationDate: fields.Expiration_Date,
          email: email,
          certStatus: 1,
          url: imageUrl,
          type: 'withpdf',
        };
        await insertCertificateData(certificateData);

        // Delete files
        if (fs.existsSync(generatedImage)) {
          // Delete the specified file
          fs.unlinkSync(generatedImage);
        }

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

        // Set response headers for PDF download
        return ({ code: 200, file: fileBuffer });

      } catch (error) {
        // Handle mongoose connection error (log it, response an error, etc.)
        console.error("Internal server error", error);
        return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
      }
    }
  } catch (error) {
    // Handle mongoose connection error (log it, response an error, etc.)
    console.error("Internal server error", error);
    return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

const handleIssueDynamicPdfCertification = async (email, certificateNumber, name, _customFields, _pdfPath, _positionX, _positionY, _qrsize) => {
  const pdfPath = _pdfPath;
  try {
    await isDBConnected();
    // Check if user with provided email exists
    const idExist = await User.findOne({ email });

    if (!idExist) {
      return ({ code: 400, status: "FAILED", message: messageCode.msgIssueNotFound, details: email });
    }
    // Check if certificate number already exists
    const isIssueExist = await DynamicIssues.findOne({ certificateNumber: certificateNumber });
    if (isIssueExist) {
      const _certStatus = await getCertificationStatus(isIssueExist.certificateStatus);
      let issuedDate = await convertDateFormat(isIssueExist.issueDate);
      let moreDetails = { certificateNumber: isIssueExist.certificateNumber, issueDate: issuedDate, certificateStatus: _certStatus };
      await cleanUploadFolder();
      return ({ code: 400, status: "FAILED", message: messageCode.msgCertIssued, details: moreDetails });
    }

    let _result = '';
    // let templateData = await extractQRCodeDataFromPDF(pdfPath)
    //   .then(result => {
    //     _result = result;
    //   })
    //   .catch(error => {
    //     console.error("Error during verification:", error);
    //   });

    let templateData = await verifyDynamicPDFDimensions(pdfPath, _qrsize)
      .then(result => {
        _result = result;
      })
      .catch(error => {
        console.error("Error during verification:", error);
      });

    // Validation checks for request data
    if (
      (idExist.status !== 1) || // User does not exist
      _result != false
    ) {
      // res.status(400).json({ message: "Please provide valid details" });
      let errorMessage = messageCode.msgPlsEnterValid;
      let moreDetails = '';
      // Check for specific error conditions and update the error message accordingly
      if (idExist.status != 1) {
        errorMessage = messageCode.msgUnauthIssuer;
      } else if (_result != false) {
        await cleanUploadFolder();
        errorMessage = messageCode.msgInvalidPdfQr;
      }

      // Respond with error message
      return ({ code: 400, status: "FAILED", message: errorMessage, details: moreDetails });
    } else {
      // If validation passes, proceed with certificate issuance
      const fields = {
        Certificate_Number: certificateNumber,
        name: name,
        customFields: _customFields
      };
      const hashedFields = {};
      for (const field in fields) {
        hashedFields[field] = calculateHash(fields[field]);
      }
      const combinedHash = calculateHash(JSON.stringify(hashedFields));

      try {
        let getContractStatus = await getContractAddress();
        if (!getContractStatus) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: messageCode.msgRpcFailed });
        }
        // Verify certificate on blockchain
        let isPaused = await newContract.paused();
        // Check if the Issuer wallet address is a valid Ethereum address
        if (!ethers.isAddress(idExist.issuerId)) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidEthereum });
        }
        const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
        const val = await newContract.verifyCertificateById(certificateNumber);
        console.log("Issuer Authorized: ", issuerAuthorized);
        if (
          val[0] === true ||
          isPaused === true ||
          issuerAuthorized === false
        ) {
          // Certificate already issued / contract paused
          let messageContent = messageCode.msgCertIssued;
          let modifiedDate = val[1] == 1 ? 'infinite expiration' : await convertEpochToDate(val[1]);
          let _certificateStatus = await getCertificationStatus(val[3]);
          let moreDetails = val[0] === true ? { certificateNumber: certificateNumber, expirationDate: modifiedDate, certificateStatus: _certificateStatus } : "";

          if (isPaused === true) {
            messageContent = messageCode.msgOpsRestricted;
          } else if (issuerAuthorized === false) {
            messageContent = messageCode.msgIssuerUnauthrized;
          }
          return ({ code: 400, status: "FAILED", message: messageContent, details: moreDetails });
        }
      } catch (error) {
        // Handle mongoose connection error (log it, response an error, etc.)
        console.error("Internal server error", error);
        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }

      try {

        var { txHash, polygonLink } = await issueCertificateWithRetry(certificateNumber, combinedHash, 1);
        if (!polygonLink || !txHash) {
          return ({ code: 400, status: false, message: messageCode.msgFailedToIssueAfterRetry, details: certificateNumber });
        }
      } catch (error) {
        return ({ code: 400, status: false, message: messageCode.msgFailedToIssueAfterRetry, details: error });
      }

      try {
        // Generate encrypted URL with certificate data
        const dataWithLink = {
          ...fields, polygonLink: polygonLink
        }
        const urlLink = await generateEncryptedUrl(dataWithLink);
        const legacyQR = false;
        let shortUrlStatus = false;
        let modifiedUrl;

        let qrCodeData = '';
        if (legacyQR) {
          // Include additional data in QR code
          qrCodeData = `Verify On Blockchain: ${polygonLink},
            Certification Number: ${dataWithLink.Certificate_Number},
            Name: ${dataWithLink.name},
            Type: 'dynamic',
            Custom Fields: ${_customFields}`;
        } else {
          // Directly include the URL in QR code
          qrCodeData = urlLink;
        }

        if (urlLink) {
          let dbStatus = await isDBConnected();
          if (dbStatus) {
            const urlData = {
              email: email,
              certificateNumber: certificateNumber,
              url: urlLink
            }
            await insertUrlData(urlData);
            shortUrlStatus = true;
          }
        }

        if (shortUrlStatus) {
          modifiedUrl = process.env.SHORT_URL + certificateNumber;
        }

        let _qrCodeData = modifiedUrl != false ? modifiedUrl : qrCodeData;
        // console.log("Short URL", _qrCodeData);

        const qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
          errorCorrectionLevel: "H", width: _qrsize, height: _qrsize
        });

        var file = pdfPath;
        var outputPdf = `${fields.Certificate_Number}${name}.pdf`;

        // Add link and QR code to the PDF file
        const opdf = await addDynamicLinkToPdf(
          path.join("./", '.', file),
          outputPdf,
          polygonLink,
          qrCodeImage,
          combinedHash,
          _positionX,
          _positionY
        );

        // Read the generated PDF file
        var fileBuffer = fs.readFileSync(outputPdf);

      } catch (error) {
        return ({ code: 400, status: "FAILED", message: messageCode.msgPdfError, details: error });
      }

      try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus === true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
        console.log(dbStatusMessage);

        // Insert certificate data into database
        const issuerId = idExist.issuerId;
        let certificateData = {
          issuerId,
          transactionHash: txHash,
          certificateHash: combinedHash,
          certificateNumber: fields.Certificate_Number,
          name: fields.name,
          email: email,
          customFields: _customFields
        };
        await insertDynamicCertificateData(certificateData);

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

        // Set response headers for PDF download
        return ({ code: 200, file: fileBuffer });

      } catch (error) {
        // Handle mongoose connection error (log it, response an error, etc.)
        console.error("Internal server error", error);
        return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
      }
    }
  } catch (error) {
    // Handle mongoose connection error (log it, response an error, etc.)
    console.error("Internal server error", error);
    return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

const bulkIssueSingleCertificates = async (email, issuerId, _pdfReponse, _excelResponse, excelFilePath, posx, posy, qrside, pdfWidth, pdfHeight) => {
  // console.log("single inputs", _pdfReponse, _excelResponse[0], excelFilePath);
  const pdfResponse = _pdfReponse;
  const excelResponse = _excelResponse;
  var insertPromises = []; // Array to hold all insert promises
  var insertUrl = [];
  var shortUrlStatus = false;
  var modifiedUrl;
  var imageUrl;
  var generatedImage;

  if (!pdfResponse || pdfResponse.length == 0) {
    return ({ code: 400, status: false, message: messageCode.msgUnableToFindPdfFiles });
  }

  try {
    // Check if the directory exists, if not, create it
    const destDirectory = path.join(__dirname, '../../uploads/completed');
    console.log("Present working directory", __dirname, destDirectory);

    if (bulkIssueStatus == 'ZIP_STORE') {
      if (fs.existsSync(destDirectory)) {
        // Delete the existing directory recursively
        fs.rmSync(destDirectory, { recursive: true });
      }
      // Recreate the directory
      fs.mkdirSync(destDirectory, { recursive: true });
      const excelFileName = path.basename(excelFilePath);
      // Destination file path
      const destinationFilePath = path.join(destDirectory, excelFileName);
      // Read the content of the source file
      const fileContent = fs.readFileSync(excelFilePath);
      // Write the content to the destination file
      fs.writeFileSync(destinationFilePath, fileContent);
    }
    
    try {
      await isDBConnected();
      console.log("working directory", __dirname);
      for (let i = 0; i < pdfResponse.length; i++) {
        const pdfFileName = pdfResponse[i];
        const pdfFilePath = path.join(__dirname, '../../uploads', pdfFileName);
        console.log("pdf directory path", pdfFilePath);

        // Extract Certs from pdfFileName
        const certs = pdfFileName.split('.')[0]; // Remove file extension
        const foundEntry = await excelResponse.find(entry => entry.Certs === certs);
        if (foundEntry) {
          // Do something with foundEntry
          console.log("Found entry for", certs);
        } else {
          console.log("No matching entry found for", certs);
          return ({ code: 400, status: false, message: messageCode.msgNoEntryMatchFound, Details: certs });
        }

        const epochExpiration = foundEntry.expirationDate != 1 ? await convertDateToEpoch(foundEntry.expirationDate) : 1;

        // const getQrStatus = await extractQRCodeDataFromPDF(pdfFilePath);
        var fields = {
          Certificate_Number: foundEntry.certificationID,
          name: foundEntry.name,
          courseName: foundEntry.certificationName,
          Grant_Date: foundEntry.grantDate,
          Expiration_Date: foundEntry.expirationDate,
        };

        var hashedFields = {};
        for (const field in fields) {
          hashedFields[field] = calculateHash(fields[field]);
        }
        var combinedHash = calculateHash(JSON.stringify(hashedFields));

        console.log("Source Cert", pdfFilePath);

        let getContractStatus = await getContractAddress();
        if (!getContractStatus) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: messageCode.msgRpcFailed });
        }

        var { txHash, polygonLink } = await issueCertificateWithRetry(foundEntry.certificationID, combinedHash, epochExpiration);
        var linkUrl = polygonLink;
        if (!linkUrl) {
          return ({ code: 400, status: false, message: messageCode.msgFaileToIssueAfterRetry, Details: certs });
        }

        // Generate encrypted URL with certificate data
        const dataWithLink = {
          ...fields, polygonLink: linkUrl
        }
        const urlLink = generateEncryptedUrl(dataWithLink);

        if (urlLink) {
          let dbStatus = await isDBConnected();
          if (dbStatus) {
            let urlData = {
              email: email,
              certificateNumber: foundEntry.certificationID,
              url: urlLink
            }
            await insertUrlData(urlData);
            shortUrlStatus = true;
          }
        }

        if (shortUrlStatus) {
          modifiedUrl = process.env.SHORT_URL + foundEntry.certificationID;
        }

        let _qrCodeData = modifiedUrl != false ? modifiedUrl : urlLink;

        const qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
          errorCorrectionLevel: "H", width: qrside, height: qrside
        });

        file = pdfFilePath;
        var outputPdf = `${pdfFileName}`;

        if (!fs.existsSync(pdfFilePath)) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidPdfUploaded });
        }

        // Add link and QR code to the PDF file
        var opdf = await addDynamicLinkToPdf(
          pdfFilePath,
          outputPdf,
          linkUrl,
          qrCodeImage,
          combinedHash,
          posx,
          posy
        );
        // Read the generated PDF file
        var fileBuffer = fs.readFileSync(outputPdf);

        // Assuming fileBuffer is available after the code you provided

        var outputPath = path.join(__dirname, '../../uploads', 'completed', `${pdfFileName}`);

        // var generatedImage = `${fields.Certificate_Number}.png`;
        let _generatedImage = `${fields.Certificate_Number}.png`;
        var generatedImage = path.join(rootDirectory, _generatedImage);
        console.log("Image path", generatedImage);

        var imageBuffer = await _convertPdfBufferToPngWithRetry(generatedImage, fileBuffer, pdfWidth, pdfHeight);

        if (imageBuffer) {
          var imageUrl = await _uploadImageToS3(fields.Certificate_Number, generatedImage);
          if (!imageUrl) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgUploadError });
          }
          insertUrl.push(imageUrl);
        } else {
          return ({ code: 400, status: "FAILED", message: messageCode.msgImageError });
        }

        try {
          await isDBConnected();
          var certificateData = {
            issuerId: issuerId,
            transactionHash: txHash,
            certificateHash: combinedHash,
            certificateNumber: fields.Certificate_Number,
            name: fields.name,
            course: fields.courseName,
            grantDate: fields.Grant_Date,
            expirationDate: fields.Expiration_Date,
            url: imageUrl
          };
          // await insertCertificateData(certificateData);
          insertPromises.push(insertBulkSingleIssueData(certificateData));

        } catch (error) {
          console.error('Error:', error);
          return ({ code: 400, status: false, message: messageCode.msgDBFailed, Details: error });

        }

        // Delete image source files (if it exists)
        if (fs.existsSync(generatedImage)) {
          // Delete the specified file
          fs.unlinkSync(generatedImage);
        }

        // Always delete the source files (if it exists)
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }

        // Always delete the source files (if it exists)
        if (fs.existsSync(outputPdf)) {
          fs.unlinkSync(outputPdf);
        }

        // fs.writeFileSync(outputPath, fileBuffer);

        // console.log('File saved successfully at:', outputPath);

      }

      // Wait for all insert promises to resolve
      await Promise.all(insertPromises);
      return ({ code: 200, status: true, Details: insertUrl });

    } catch (error) {
      return ({ code: 500, status: false, message: messageCode.msgDBFailed, Details: error });
    }

  } catch (error) {
    return ({ code: 500, status: false, message: messageCode.msgInternalError, Details: error });
  }
};

const bulkIssueBatchCertificates = async (email, issuerId, _pdfReponse, _excelResponse, excelFilePath, posx, posy, qrside, pdfWidth, pdfHeight) => {
  // console.log("Batch inputs", _pdfReponse, excelFilePath);
  const pdfResponse = _pdfReponse;
  const excelResponse = _excelResponse[0];
  var insertPromises = []; // Array to hold all insert promises
  var insertUrl = [];
  var shortUrlStatus = false;
  var modifiedUrl;
  var imageUrl;
  var generatedImage;

  if (!pdfResponse || pdfResponse.length == 0) {
    return ({ code: 400, status: false, message: messageCode.msgUnableToFindPdfFiles });
  }

  try {
    // Check if the directory exists, if not, create it
    const destDirectory = path.join(__dirname, '../../uploads/completed');
    console.log("Present working directory", __dirname, destDirectory);

    if (bulkIssueStatus == 'ZIP_STORE') {
      if (fs.existsSync(destDirectory)) {
        // Delete the existing directory recursively
        fs.rmSync(destDirectory, { recursive: true });
      }
      // Recreate the directory
      fs.mkdirSync(destDirectory, { recursive: true });
      const excelFileName = path.basename(excelFilePath);
      // Destination file path
      const destinationFilePath = path.join(destDirectory, excelFileName);
      // Read the content of the source file
      const fileContent = fs.readFileSync(excelFilePath);
      // Write the content to the destination file
      fs.writeFileSync(destinationFilePath, fileContent);
    }

    var transformedResponse = _excelResponse[2];
    // return ({ code: 400, status: false, message: messageCode.msgUnderConstruction, Details: `${transformedResponse}, ${pdfResponse}`});

    const hashedBatchData = transformedResponse.map(data => {
      // Convert data to string and calculate hash
      const dataString = data.map(item => item.toString()).join('');
      const _hash = calculateHash(dataString);
      return _hash;
    });
    // Format as arrays with corresponding elements using a loop
    var values = [];
    for (let i = 0; i < excelResponse.length; i++) {
      values.push([hashedBatchData[i]]);
    }
    try {

      // Generate the Merkle tree
      let tree = StandardMerkleTree.of(values, ['string']);
      let batchExpiration = 1;
      try {
        let getContractStatus = await getContractAddress();
        if (!getContractStatus) {
          return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: messageCode.msgRpcFailed });
        }

        var batchNumber = await newContract.getRootLength();
        var allocateBatchId = parseInt(batchNumber) + 1;

        var { txHash, polygonLink } = await issueBatchCertificateWithRetry(tree.root, batchExpiration);
        var linkUrl = polygonLink;
        if (!linkUrl) {
          return ({ code: 400, status: false, message: messageCode.msgFaileToIssueAfterRetry });
        }

      } catch (error) {
        return ({ code: 400, status: false, message: messageCode.msgFailedAtBlockchain, Details: error });
      }

      if (pdfResponse.length == _excelResponse[1]) {
        console.log("working directory", __dirname);

        for (let i = 0; i < pdfResponse.length; i++) {
          var pdfFileName = pdfResponse[i];
          var pdfFilePath = path.join(__dirname, '../../uploads', pdfFileName);
          console.log("pdf directory path", pdfFilePath);

          // Extract Certs from pdfFileName
          const certs = pdfFileName.split('.')[0]; // Remove file extension
          const foundEntry = await excelResponse.find(entry => entry.Certs === certs);
          if (foundEntry) {
            var index = excelResponse.indexOf(foundEntry);
            var _proof = tree.getProof(index);

            let buffers = _proof.map(hex => Buffer.from(hex.slice(2), 'hex'));
            // Concatenate all Buffers into one
            let concatenatedBuffer = Buffer.concat(buffers);
            // Calculate SHA-256 hash of the concatenated buffer
            var _proofHash = crypto.createHash('sha256').update(concatenatedBuffer).digest('hex');
            // Do something with foundEntry
            console.log("Found entry for", certs);
            // You can return or process foundEntry here
          } else {
            console.log("No matching entry found for", certs);
            return ({ code: 400, status: false, message: messageCode.msgNoEntryMatchFound, Details: certs });
          }

          var fields = {
            Certificate_Number: foundEntry.certificationID,
            name: foundEntry.name,
            courseName: foundEntry.certificationName,
            Grant_Date: foundEntry.grantDate,
            Expiration_Date: foundEntry.expirationDate,
            polygonLink: linkUrl
          };

          var combinedHash = hashedBatchData[index];


          // Generate encrypted URL with certificate data
          var encryptLink = await generateEncryptedUrl(fields);

          if (encryptLink) {
            let dbStatus = await isDBConnected();
            if (dbStatus) {
              let urlData = {
                email: email,
                certificateNumber: foundEntry.certificationID,
                url: encryptLink
              }
              await insertUrlData(urlData);
              shortUrlStatus = true;
            }
          }

          if (shortUrlStatus) {
            modifiedUrl = process.env.SHORT_URL + foundEntry.certificationID;
          }

          let _qrCodeData = modifiedUrl != false ? modifiedUrl : encryptLink;

          const qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
            errorCorrectionLevel: "H", width: qrside, height: qrside
          });

          file = pdfFilePath;
          var outputPdf = `${pdfFileName}`;

          if (!fs.existsSync(pdfFilePath)) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidPdfUploaded });
          }
          // Add link and QR code to the PDF file
          var opdf = await addDynamicLinkToPdf(
            pdfFilePath,
            outputPdf,
            linkUrl,
            qrCodeImage,
            combinedHash,
            posx,
            posy
          );
          if (!fs.existsSync(outputPdf)) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidFilePath });
          }
          // Read the generated PDF file
          var fileBuffer = fs.readFileSync(outputPdf);

          // Assuming fileBuffer is available after the code you provided
          var outputPath = path.join(__dirname, '../../uploads', 'completed', `${pdfFileName}`);
          
          if (bulkIssueStatus == 'ZIP_STORE') {
            imageUrl = '';
            generatedImage = null;
          } else {
            let _generatedImage = `${fields.Certificate_Number}.png`;
            generatedImage = path.join(rootDirectory, _generatedImage);
            console.log("Image path", generatedImage);

            var imageBuffer = await _convertPdfBufferToPngWithRetry(generatedImage, fileBuffer, pdfWidth, pdfHeight);

            if (imageBuffer) {
              imageUrl = await _uploadImageToS3(fields.Certificate_Number, generatedImage);
              if (!imageUrl) {
                return ({ code: 400, status: "FAILED", message: messageCode.msgUploadError });
              }
              insertUrl.push(imageUrl);
            } else {
              return ({ code: 400, status: "FAILED", message: messageCode.msgImageError });
            }
          }

          try {
            await isDBConnected();
            var certificateData = {
              issuerId: issuerId,
              batchId: allocateBatchId,
              proofHash: _proof,
              encodedProof: `0x${_proofHash}`,
              transactionHash: txHash,
              certificateHash: combinedHash,
              certificateNumber: fields.Certificate_Number,
              name: fields.name,
              course: fields.courseName,
              grantDate: fields.Grant_Date,
              expirationDate: fields.Expiration_Date,
              url: imageUrl
            };
            // await insertCertificateData(certificateData);
            insertPromises.push(insertBulkBatchIssueData(certificateData));

          } catch (error) {
            console.error('Error:', error);
            return ({ code: 400, status: false, message: messageCode.msgDBFailed, Details: error });
          }

          // Delete image source files (if it exists)
          if (fs.existsSync(generatedImage)) {
            // Delete the specified file
            fs.unlinkSync(generatedImage);
          }

          // Always delete the source files (if it exists)
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }

          // Always delete the source files (if it exists)
          if (fs.existsSync(outputPdf)) {
            fs.unlinkSync(outputPdf);
          }

          if (bulkIssueStatus == 'ZIP_STORE') {
            fs.writeFileSync(outputPath, fileBuffer);
            console.log('File saved successfully at:', outputPath);
          }

        }
        // Wait for all insert promises to resolve
        await Promise.all(insertPromises);
        if (bulkIssueStatus == 'ZIP_STORE') {
          return ({ code: 200, status: true });
        }
        return ({ code: 200, status: true, message: messageCode.msgBatchIssuedSuccess, Details: insertUrl });
      } else {
        return ({ code: 400, status: false, message: messageCode.msgInputRecordsNotMatched, Details: error });
      }

    } catch (error) {
      return ({ code: 400, status: false, message: messageCode.msgFailedToIssueBulkCerts, Details: error });
    }

  } catch (error) {
    return ({ code: 500, status: false, message: messageCode.msgInternalError, Details: error });
  }

};

const issueCertificateWithRetry = async (certificateNumber, certificateHash, expirationEpoch, retryCount = 3) => {
  try {
    // Issue Single Certifications on Blockchain
    const tx = await newContract.issueCertificate(
      certificateNumber,
      certificateHash,
      expirationEpoch
    );
    let txHash = tx.hash;

    if (!txHash) {
      if (retryCount > 0) {
        console.log(`Unable to process the transaction. Retrying... Attempts left: ${retryCount}`);
        // Retry after a delay (e.g., 1.5 seconds)
        await holdExecution(1500);
        return issueCertificateWithRetry(certificateNumber, certificateHash, expirationEpoch, retryCount - 1);
      }
    }

    let polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

    return { txHash, polygonLink };

  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return issueCertificateWithRetry(certificateNumber, certificateHash, expirationEpoch, retryCount - 1);
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
        return issueCertificateWithRetry(root, expirationEpoch, retryCount - 1);
      }
    }

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

const convertPdfBufferToPngWithRetry = async (imagePath, pdfBuffer, retryCount = 3) => {

  try {
    const imageResponse = await convertPdfBufferToPng(imagePath, pdfBuffer);
    if (!imageResponse) {
      if (retryCount > 0) {
        console.log(`Image conversion failed. Retrying... Attempts left: ${retryCount}`);
        // Retry after a delay (e.g., 1 second)
        await holdExecution(1000);
        let pngExist = await checkForPngFiles(rootDirectory);
        if (pngExist) {
          await deletePngFiles(rootDirectory);
        }
        return convertPdfBufferToPngWithRetry(imagePath, pdfBuffer, retryCount - 1);
      } else {
        // throw new Error('Image conversion failed after multiple attempts');
        return null;
      }
    }
    return imageResponse;
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return convertPdfBufferToPngWithRetry(imagePath, pdfBuffer, retryCount - 1);
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
}

const convertPdfBufferToPng = async (imagePath, pdfBuffer) => {
  if (!imagePath || !pdfBuffer) {
    return false;
  }
  const options = {
    format: 'png', // Specify output format (optional, defaults to 'png')
    responseType: 'buffer', // Ensure binary output (PNG buffer)
    width: 2067, // Optional width for the image
    height: 1477, // Optional height for the image
    density: 100, // Optional DPI (dots per inch)
    // Other options (refer to pdf2pic documentation for details)
  };

  try {
    const convert = fromBuffer(pdfBuffer, options);
    const pageOutput = await convert(1, { responseType: 'buffer' }); // Convert page 1 (adjust as needed)
    let base64String = await pageOutput.base64;
    // Remove the data URL prefix if present
    const base64Data = await base64String.replace(/^data:image\/png;base64,/, '');

    // Convert Base64 to buffer
    const _buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(imagePath, _buffer, (err) => {
      if (err) {
        console.error("Error writing PNG file:", err);
        return false;
      }
    });
    // Save the PNG buffer to a file
    return true;
  } catch (error) {
    console.error('Error converting PDF to PNG buffer:', error);
    return false;
  }
};

const uploadImageToS3 = async (certNumber, imagePath) => {

  const bucketName = process.env.BUCKET_NAME;
  const timestamp = Date.now(); // Get the current timestamp in milliseconds
  const keyName = `${certNumber}_${timestamp}.png`;
  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(imagePath);
  const acl = process.env.ACL_NAME;

  let uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ACL: acl
  };

  try {
    const urlData = await s3.upload(uploadParams).promise();
    return urlData.Location;
  } catch (error) {
    console.error("Internal server error", error);
    return false;
  }
};

const _convertPdfBufferToPngWithRetry = async (imagePath, pdfBuffer, _width, _height, retryCount = 3) => {

  try {
    const imageResponse = await _convertPdfBufferToPng(imagePath, pdfBuffer, _width, _height);
    if (!imageResponse) {
      if (retryCount > 0) {
        console.log(`Image conversion failed. Retrying... Attempts left: ${retryCount}`);
        // Retry after a delay (e.g., 2 seconds)
        await holdExecution(2000);
        let pngExist = await checkForPngFiles(rootDirectory);
        if (pngExist) {
          await deletePngFiles(rootDirectory);
        }
        return _convertPdfBufferToPngWithRetry(imagePath, pdfBuffer, _width, _height, retryCount - 1);
      } else {
        // throw new Error('Image conversion failed after multiple attempts');
        return null;
      }
    }
    return imageResponse;
  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return _convertPdfBufferToPngWithRetry(imagePath, pdfBuffer, _width, _height, retryCount - 1);
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
}

const _convertPdfBufferToPng = async (imagePath, pdfBuffer, _width, _height) => {
  if (!imagePath || !pdfBuffer) {
    return false;
  }
  const options = {
    format: 'png', // Specify output format (optional, defaults to 'png')
    responseType: 'buffer', // Ensure binary output (PNG buffer)
    // width: _width, // Optional width for the image
    // height: _height, // Optional height for the image
    density: 100, // Optional DPI (dots per inch)
    // Other options (refer to pdf2pic documentation for details)
  };

  try {
    const convert = fromBuffer(pdfBuffer, options);
    const pageOutput = await convert(1, { responseType: 'buffer' }); // Convert page 1 (adjust as needed)
    let base64String = await pageOutput.base64;
    // Remove the data URL prefix if present
    const base64Data = await base64String.replace(/^data:image\/png;base64,/, '');

    // Convert Base64 to buffer
    const _buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(imagePath, _buffer, (err) => {
      if (err) {
        console.error("Error writing PNG file:", err);
        return false;
      }
    });
    // Save the PNG buffer to a file
    return true;
  } catch (error) {
    console.error('Error converting PDF to PNG buffer:', error);
    return false;
  }
};

const _uploadImageToS3 = async (certNumber, imagePath) => {

  const bucketName = process.env.BUCKET_NAME;
  const timestamp = Date.now(); // Get the current timestamp in milliseconds
  const _keyName = `${certNumber}_${timestamp}.png`;
  const s3 = new AWS.S3();
  const fileStream = fs.createReadStream(imagePath);
  const acl = process.env.ACL_NAME;
  const keyPrefix = 'dynamic_bulk_issues/';

  const keyName = keyPrefix + _keyName;

  let uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ACL: acl
  };

  try {
    const urlData = await s3.upload(uploadParams).promise();
    return urlData.Location;
  } catch (error) {
    console.error("Internal server error", error);
    return false;
  }
};

module.exports = {
  // Function to issue a certification
  handleIssueCertification,
  // Function to issue a PDF certificate
  handleIssuePdfCertification,
  // Function to issue a Dynamic QR certification (single)
  handleIssueDynamicPdfCertification,
  // Function to issue a Dynamic QR Bulk certification (single)
  bulkIssueSingleCertificates,
  // Function to issue a Dynamic QR Bulk certification (batch)
  bulkIssueBatchCertificates
};
