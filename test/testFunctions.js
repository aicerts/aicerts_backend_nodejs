// Load environment variables from .env file
require('dotenv').config();
const { PDFDocument } = require('pdf-lib');
const path = require("path"); // Module for working with file paths
const fs = require("fs");
const { ethers } = require("ethers"); // Ethereum JavaScript library

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../src/config/abi.json");


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

// Simulate a hold execution function for testing
const holdExecution = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const issueDynamicCertificateWithRetry = async (certificateNumber, certificateHash, expirationEpoch, retryCount = 3) => {
  // console.log("Inputs", certificateNumber, certificateHash, expirationEpoch);
  
  try {
    // Validate inputs
    if (typeof certificateNumber !== 'string' || !/^[a-zA-Z0-9]+$/.test(certificateNumber)) {
      throw new Error('Invalid certificate number format');
    }
    if (typeof certificateHash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(certificateHash)) {
      throw new Error('Invalid certificate hash format');
    }
    if (typeof expirationEpoch <= 0) {
      throw new Error('Invalid expiration epoch value');
    }

    // Simulate issuing a certificate
    // console.log("Certificate issued successfully");

    return ({ code: 200, message: "Certificate issued successfully" });

  } catch (error) {
    if (error.reason == 'Certificate already issued') {
      return ({ code: 200, message: "issued" });
    }
    if (error.code == 'INVALID_ARGUMENT' || error.code == 'REPLACEMENT_ERROR') {
      return ({ code: 400, message: messageCode.msgInvalidArguments, details: error.reason });
    }
    if (error.code == 'INSUFFICIENT_FUNDS') {
      return ({ code: 400, message: messageCode.msgInsufficientFunds, details: error.reason });
    }
    if (error.code === 'NONCE_EXPIRED') {
      return ({ code: 429, message: messageCode.msgNonceExpired, details: error.reason });
    }
    if (retryCount > 0) {
      console.log(`Error occurred: ${error.message}. Retrying... Attempts left: ${retryCount}`);
      await holdExecution(2000);
      return issueDynamicCertificateWithRetry(certificateNumber, certificateHash, expirationEpoch, retryCount - 1);
    }
    console.error("Request failed after retries.", error);
    return ({ code: 400, message: error.message });
  }
};

const verifyDynamicPDFDimensions = async (pdfPath, qrSide) => {
    // Extract QR code data from the PDF file
    const certificateData = await extractQRCodeDataFromPDF(pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
  
    const firstPage = pdfDoc.getPages()[0];
    const { width, height } = firstPage.getSize();
    const qrSize = qrSide * qrSide;
    const documentSize = width * height;
  
    console.log("document and QR", documentSize, qrSize);
    // Check if dimensions fall within the specified ranges
    if ((documentSize > qrSize) &&
      (certificateData == false)) {
      // console.log("The certificate width x height (in mm):", widthMillimeters, heightMillimeters);
      return false;
    } else {
      // throw new Error('PDF dimensions must be within 240-260 mm width and 340-360 mm height');
      return true;
    }
  };

  const extractQRCodeDataFromPDF = async (pdfFilePath) => {
    try {
    
      // Throw error if QR code text is not available
      if (!pdfFilePath) {
        // throw new Error("QR Code Text could not be extracted from PNG image");
        console.log("QR Code Not Found / QR Code Text could not be extracted");
        return false;
      } else {
        return true;
      }
  
    } catch (error) {
      // Log and rethrow any errors that occur during the process
      console.error(error);
      // throw error;
      return false;
    }
  };

  // Function to convert the Date format
const convertDateFormat = async (dateString) => {
    
    if (dateString.length < 8) {
      return null;
    }
    if (dateString.length < 11) {
      // Parse the date string to extract month, day, and year
      const [month, day, year] = dateString.split('/');
      let formatDate = `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
      const numericMonth = parseInt(month, 10);
      const numericDay = parseInt(day, 10);
      const numericYear = parseInt(year, 10);
      // Check if month, day, and year are within valid ranges
      if (numericMonth > 0 && numericMonth <= 12 && numericDay > 0 && numericDay <= 31 && numericYear >= 1900 && numericYear <= 9999) {
        if ((numericMonth == 1 || numericMonth == 3 || numericMonth == 5 || numericMonth == 7 ||
          numericMonth == 8 || numericMonth == 10 || numericMonth == 12) && numericDay <= 31) {
          return formatDate;
        } else if ((numericMonth == 4 || numericMonth == 6 || numericMonth == 9 || numericMonth == 11) && numericDay <= 30) {
          return formatDate;
        } else if (numericMonth == 2 && numericDay <= 29) {
          if (numericYear % 4 == 0 && numericDay <= 29) {
            // Leap year: February has 29 days
            return formatDate;
          } else if (numericYear % 4 != 0 && numericDay <= 28) {
            // Non-leap year: February has 28 days
            return formatDate;
          } else {
            return null;
          }
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
}

const cleanUploadFolder = async () => {
    const uploadFolder = './uploads'; // Specify the folder path you want
    const folderPath = path.join(__dirname, '../test', uploadFolder);
  
    // Check if the folder is not empty
    const filesInFolder = fs.readdirSync(folderPath);
  
    if (filesInFolder.length > 0) {
      // Delete all files in the folder
      filesInFolder.forEach(fileToDelete => {
        const filePathToDelete = path.join(folderPath, fileToDelete);
        try {
          fs.unlinkSync(filePathToDelete);
        } catch (error) {
          console.error("Error deleting file:", filePathToDelete, error);
        }
      });
    }
    // Remove the directory if it's empty
    try {
        // Check if the directory still exists before trying to read it
        if (fs.existsSync(folderPath)) {
          const remainingFiles = fs.readdirSync(folderPath);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(folderPath);
            console.log(`Removed empty directory ${folderPath}`);
          }
        } else {
          console.warn(`Directory ${folderPath} does not exist anymore`);
        }
      } catch (err) {
        console.error(`Error removing directory ${folderPath}:`, err);
      }
  };

  module.exports = {
    holdExecution,
    issueDynamicCertificateWithRetry,
    verifyDynamicPDFDimensions,
    extractQRCodeDataFromPDF,
    convertDateFormat,
    cleanUploadFolder
  };