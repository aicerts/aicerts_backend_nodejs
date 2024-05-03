// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const winston = require("winston");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path"); // Module for working with file paths
const { ethers } = require("ethers"); // Ethereum JavaScript library
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const keccak256 = require('keccak256');

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'combined.log' })
    ],
});
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.simple(),
    }));
  }

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../utils/abi.json");

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../utils/cryptoFunction");
// Importing functions from a custom module
const {
    addLinkToPdf, // Function to add a link to a PDF file
    isDBConnected,
    insertCertificateData,
    insertBatchCertificateData,
    holdExecution,
    calculateHash, // Function to calculate the hash of a file
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

const issuePdfCertificates = async (_pdfReponse, _excelResponse) => {

    const pdfResponse = _pdfReponse;
    const excelResponse = _excelResponse;
    var insertPromises = []; // Array to hold all insert promises

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelResponse.map(item => item.Certs + ".pdf");
    // Compare certsWithPDF with data2
    const matchedCerts = pdfResponse.filter(cert => certsWithPDF.includes(cert));

    if (pdfResponse.length == matchedCerts.length) {
        // Check if the directory exists, if not, create it
           const destDirectory = path.join(__dirname, '../../uploads/completed');
            if (fs.existsSync(destDirectory)) {
            // Delete the existing directory recursively
                fs.rmSync(destDirectory, { recursive: true });
            }
            // Recreate the directory
            fs.mkdirSync(destDirectory, { recursive: true });
        try {
            await isDBConnected();
            for (let i = 0; i < pdfResponse.length; i++) {
                const pdfFileName = pdfResponse[i];
                const pdfFilePath = path.join(__dirname, '../../uploads', pdfFileName);

                // const certificateDimensions = await verifyPDFDimensions(pdfFilePath);

                // Extract Certs from pdfFileName
                const certs = pdfFileName.split('.')[0]; // Remove file extension
                const foundEntry = await excelResponse.find(entry => entry.Certs === certs);
                if (foundEntry) {
                    // Do something with foundEntry
                    console.log("Found entry for", certs);
                    // You can return or process foundEntry here
                } else {
                    console.log("No matching entry found for", certs);
                }
                // const getQrStatus = await extractQRCodeDataFromPDF(pdfFilePath);
                var fields = {
                    Certificate_Number: foundEntry.certificationID,
                    name: foundEntry.name,
                    courseName: foundEntry.certificationName,
                    Grant_Date: foundEntry.grantDate,
                    Expiration_Date: foundEntry.expirationDate,
                };

                // console.log("The data", fields);
                // return false

                // Parse the input date string into a Date object
                const dateObj = new Date(fields.Expiration_Date);

                // Convert the Date object to epoch time (milliseconds since January 1, 1970)
                const epochExpiration = dateObj.getTime();

                var hashedFields = {};
                for (const field in fields) {
                    hashedFields[field] = calculateHash(fields[field]);
                }
                var combinedHash = calculateHash(JSON.stringify(hashedFields));

                console.log("Source Cert", pdfFilePath);
                
                var {txHash, linkUrl} = await issueCertificateWithRetry(fields.Certificate_Number, combinedHash, epochExpiration);
                if (!linkUrl) {
                    console.error("Failed to issue certificate after retries.");
                }

                try{
                    await isDBConnected();
                    var certificateData = {
                        issuerId : process.env.ACCOUNT_ADDRESS,
                        transactionHash: txHash,
                        certificateHash: combinedHash,
                        certificateNumber: fields.Certificate_Number,
                        name: fields.name,
                        course: fields.courseName,
                        grantDate: fields.Grant_Date,
                        expirationDate: fields.Expiration_Date
                      };
                    // await insertCertificateData(certificateData);
                    insertPromises.push(insertCertificateData(certificateData));

                } catch(error){
                    console.error('Error:', error);
                    // res.status(400).json({ status: "FAILED", message: "Failed to interact with Database", details: error });
                    return;
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

                file = pdfFilePath;
                var outputPdf = `${pdfFileName}`;
        
                // Add link and QR code to the PDF file
                var opdf = await addLinkToPdf(
                    path.join("./", file),
                    outputPdf,
                    linkUrl,
                    qrCodeImage,
                    combinedHash
                );
                // Read the generated PDF file
                var fileBuffer = fs.readFileSync(outputPdf);


                // Assuming fileBuffer is available after the code you provided
                
                var outputPath = path.join(__dirname, '../../uploads', 'completed', `${pdfFileName}`);

                
                // Always delete the source files (if it exists)
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }

                // Always delete the source files (if it exists)
                if (fs.existsSync(outputPdf)) {
                    fs.unlinkSync(outputPdf);
                }

                fs.writeFileSync(outputPath, fileBuffer);

                console.log('File saved successfully at:', outputPath);

            }

            // Wait for all insert promises to resolve
            await Promise.all(insertPromises);
            return true;
        } catch (error) {
            console.error("Internal server error", error);
        }

    } else {
        return false;
    }
};



const issueCertificateWithRetry = async (certificateNumber, certificateHash, epochExpiration, retryCount = 3) => {
    
    // const simulateCall = await getRawTransaction(certificateNumber, certificateHash, epochExpiration);
    // console.log("Raw tx", simulateCall);
    try {
        // Issue Single Certifications on Blockchain
        const tx = await newContract.issueCertificate(
            certificateNumber,
            certificateHash,
            epochExpiration
        );

        var txHash = tx.hash;

        var linkUrl = `https://${process.env.NETWORK}/tx/${txHash}`;
        console.log("Hash", txHash);

        return {txHash, linkUrl};

      } catch (error) {
        if (retryCount > 0 && error.code === 'ETIMEDOUT') {
            console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
            // Retry after a delay (e.g., 2 seconds)
            await holdExecution(2000);
            return issueCertificateWithRetry(certificateNumber, certificateHash, epochExpiration, retryCount - 1);
        }else if (error.code === 'NONCE_EXPIRED') {
            // Extract and handle the error reason
            console.log("Error reason:", error.reason);
            return null;
        } else if (error.reason) {
            // Extract and handle the error reason
            console.log("Error reason:", error.reason);
            return null;
        } else {
            // If there's no specific reason provided, handle the error generally
            console.error("Failed to perform operation at Blockchain", error);
            return null;
        }
      }
};

const getRawTransaction = async (certificateNumber, certificateHash, epochExpiration) => {
    try {
        // Create a new transaction object without sending it
        const unsignedTx = await newContract.populateTransaction.issueCertificate(
            certificateNumber,
            certificateHash,
            epochExpiration
        );
        // Set additional transaction properties (adjust based on your needs)
        unsignedTx.gasLimit = 1000000; // Set a gas limit
        unsignedTx.chainId = 11155111; // Set the chain ID
    
        // Get the serialized raw transaction data
        console.log("Raw tx", unsignedTx);
        // Get the serialized raw transaction data
        const rawTx = ethers.utils.serializeTransaction(unsignedTx);

        return rawTx;
    } catch (error) {
        console.error("Error:", error.message);
    }
};


module.exports = {
    // Function to issue a PDF certificates
    issuePdfCertificates,

};