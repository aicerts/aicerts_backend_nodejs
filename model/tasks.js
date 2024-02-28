// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const multer = require("multer"); // Middleware for handling multipart/form-data
const Web3 = require("web3"); // Ethereum JavaScript API
const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument, Rectangle } = pdf;
const fs = require("fs"); // File system module
const path = require("path"); // Module for working with file paths
const { fromPath } = require("pdf2pic"); // Converter from PDF to images
const pdftopic = require("pdftopic");
const Jimp = require("jimp");
const { PNG } = require("pngjs"); // PNG image manipulation library
const jsQR = require("jsqr"); // JavaScript QR code reader
const { ethers } = require("ethers"); // Ethereum JavaScript library
const mongoose = require("mongoose"); // MongoDB object modeling tool
const nodemailer = require('nodemailer'); // Module for sending emails
const readXlsxFile = require('read-excel-file/node');
const utils = require('../config/utils.js');

const {  decryptData, generateEncryptedUrl } = require("../common/cryptoFunction"); // Custom functions for cryptographic operations


// Create a nodemailer transporter using the provided configuration
const transporter = nodemailer.createTransport({
  // Specify the email service provider (e.g., Gmail, Outlook)
  service: process.env.MAIL_SERVICE,
  // Specify the email server host (e.g., smtp.gmail.com)
  host: process.env.MAIL_HOST,
  // Specify the port number for SMTP (587 for most services)
  port: 587,
  // Specify whether to use TLS (Transport Layer Security)
  secure: false,
  // Provide authentication details for the email account
  auth: {
    // Specify the email address used for authentication
    user: process.env.USER_NAME, // replace with your Gmail email
    // Specify the password associated with the email address
    pass: process.env.MAIL_PWD,  // replace with your Gmail password
  },
});


// Define nodemailer mail options for sending emails
const mailOptions = {
  // Specify the sender's information
  from: {
    // Name of the sender
    name: 'AICerts Admin',
    // Sender's email address (obtained from environment variable)
    address: process.env.USER_MAIL,
  },
  // Specify the recipient's email address (to be filled dynamically)
  to: '', // replace with recipient's email address
  // Subject line of the email
  subject: 'AICerts Admin Notification',
  // Plain text content of the email body (to be filled dynamically)
  text: '', // replace with text content of the email body
};


// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Retrieve contract address from environment variable
const contractAddress = process.env.CONTRACT_ADDRESS;

// Retrieve account address from environment variable
const account = process.env.ACCOUNT_ADDRESS;

// Create a new ethers provider using the default provider and the RPC endpoint from environment variable
const _provider = new ethers.providers.getDefaultProvider(process.env.RPC_ENDPOINT);

// Create a new ethers contract instance for read-only operations (using the contract ABI and provider)
const adminRouter = new ethers.Contract(contractAddress, abi, _provider);

// Create a new ethers wallet instance using the private key from environment variable and the provider
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, _provider);

// Create a new ethers contract instance with a signing capability (using the contract ABI and wallet)
const _contract = new ethers.Contract(contractAddress, abi, wallet);


// Import the Issues models from the schema defined in "../config/schema"
const { Issues, BatchIssues } = require("../config/schema");

// Example usage: Excel Headers
const expectedHeadersSchema = [
  'certificationID',
  'name',
  'certificationName',
  'grantDate',
  'expirationDate'
];

// Fetch records from the excel file
const fetchExcelRecord = async (_path) => {
  // api to fetch excel data into json
  const newPath = path.join(..._path.split("\\"));
  const sheetNames = await readXlsxFile.readSheetNames(newPath);
  try {
    if(sheetNames == "Batch"){
      // api to fetch excel data into json
      const rows = await readXlsxFile(newPath, {sheet: 'Batch'});
      // Check if the extracted headers match the expected pattern
      const isValidHeaders = JSON.stringify(rows[0]) === JSON.stringify(expectedHeadersSchema);
      if(isValidHeaders){
        const headers = rows.shift();
        const targetData = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj; // Return the fetched rows
        });
  
        return { status: "SUCCESS", response: true, message: [targetData, rows.length, rows] };

      } else {
        return { status: "FAILED", response: false, message: "Invalid headers in the Excel file." };
      }
    } else {
      return { status: "FAILED", response: false, message: "The Excel Sheet name should be - Batch." };
    }
      
  } catch (error) {
      console.error('Error fetching record:', error);
      throw error; // Rethrow the error for handling it in the caller function
      
  }
}

// Function to insert certificate data into MongoDB
const insertCertificateData = async (data) => {
  try {
    // Create a new Issues document with the provided data
      const newIssue = new Issues({ 
              id: data.id,
              transactionHash: data.transactionHash,
              certificateHash: data.certificateHash,
              certificateNumber: data.certificateNumber,
              name: data.name,
              course: data.course,
              grantDate: data.grantDate,
              expirationDate: data.expirationDate,
              issueDate: Date.now() // Set the issue date to the current timestamp
      });
      
    // Save the new Issues document to the database
    const result = await newIssue.save();

      // const idExist = await User.findOne({ id: data.id });

      // if(idExist) {
      //   const previousCount = await idExist.counter;
      //   idExist.counter = previousCount+1;
      //   User.save();
      // } else {
      //   console.log("Counter not updated");
      // }
    // Logging confirmation message
    console.log("Certificate data inserted");
  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error("Error connecting to MongoDB:", error);
  }
};

const insertBatchCertificateData = async (data) => {
  try {
    
      // Insert data into MongoDB
      const newBatchIssue = new BatchIssues({ 
              issuerId: data.id,
              batchId: data.batchId,
              proofHash: data.proofHash,
              transactionHash: data.transactionHash,
              certificateHash: data.certificateHash,
              certificateNumber: data.certificateNumber,
              name: data.name,
              course: data.course,
              grantDate: data.grantDate,
              expirationDate: data.expirationDate,
              issueDate: Date.now()
      });
      
      const result = await newBatchIssue.save();

      // const idExist = await User.findOne({ id: data.id });

      // if(idExist) {
      //   const previousCount = await idExist.counter;
      //   idExist.counter = previousCount+1;
      //   User.save();
      // } else {
      //   console.log("Counter not updated");
      // }
      // console.log("Batch Certificate data inserted");
      } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
};

const extractCertificateInfo = (qrCodeText) => {
  console.log("QR Code Text", qrCodeText);
  // Check if the data starts with 'http://' or 'https://'
  if (qrCodeText.startsWith('http://') ||  qrCodeText.startsWith('https://')) {
    // If it's an encrypted URL, extract the query string parameters q and iv
    const url = decodeURIComponent(qrCodeText);
    const qIndex = url.indexOf("q=");
    const ivIndex = url.indexOf("iv=");
    const q = url.substring(qIndex + 2, ivIndex - 1);
    const iv = url.substring(ivIndex + 3);

    // Decrypt the data using the provided q and iv parameters
    const fetchDetails = decryptData(q, iv);
    
      // Parse the JSON string into a JavaScript object
      const parsedData = JSON.parse(fetchDetails);
    // Create a new object with desired key-value mappings for certificate information
    const convertedData = {
        "Certificate Number": parsedData.Certificate_Number,
        "Course Name": parsedData.courseName,
        "Expiration Date": parsedData.Expiration_Date,
        "Grant Date": parsedData.Grant_Date,
        "Name": parsedData.name,
        "Polygon URL": parsedData.polygonLink
      };
      // console.log("Data of Redirect", convertedData);
      return convertedData;
  } else {
    // If it's not an encrypted URL, assume it's plain text and split by new lines
    const lines = qrCodeText.split("\n");

    // Initialize an object to store certificate information
    const certificateInfo = {
        "Verify On Blockchain": "",
        "Certification Number": "",
        "Name": "",
        "Certification Name": "",
        "Grant Date": "",
        "Expiration Date": ""
      };

    // Loop through each line of the text
    for (const line of lines) {
      const parts = line.trim().split(/:\s+/); // Use a regular expression to split by colon followed by optional whitespace
      // If there are two parts (a key-value pair), extract the key and value
      if (parts.length === 2) {
        const key = parts[0].trim();
        let value = parts[1].trim();
  
        // Remove commas from the value (if any)
        value = value.replace(/,/g, "");

        // Map the key-value pairs to corresponding fields in the certificateInfo object
        if(key === "Verify On Blockchain") {
                certificateInfo["Polygon URL"] = value;
            } else if (key === "Certification Number") {
                certificateInfo["Certificate Number"] = value;
            } else if (key === "Name") {
                certificateInfo["Name"] = value;
            } else if (key === "Certification Name") {
                certificateInfo["Course Name"] = value;
            } else if (key === "Grant Date") {
                certificateInfo["Grant Date"] = value;
            } else if (key === "Expiration Date") {
                certificateInfo["Expiration Date"] = value;
            }
        }
    }
    // console.log("Data LMS ", certificateInfo);
    return certificateInfo;
  }
  
};

const extractQRCodeDataFromPDF = async (pdfFilePath) => {
  console.log("pdf path", pdfFilePath);
  try {
    const options = {
      density: 100,
      saveFilename: "certificate",
      savePath: "./uploads",
      format: "png",
      width: 2756,
      height: 1969
    };
    
    // Function to convert the entire PDF to a single image
    const convertPDFToImage = async (pdfPath, options) => {
      const storeAsImage = fromPath(pdfPath, options);
      const imageBuffer = await storeAsImage();
      return imageBuffer;
    };
    
    // Path to the PDF file
    const pdfPath = pdfFilePath;
    const outputPath = options.savePath; // Output directory
    
    // Ensure output directory exists, create it if it doesn't
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Convert PDF to a single image
    convertPDFToImage(pdfPath, options)
    .then(imageBuffer => {
      // Write the image buffer to a file
      fs.writeFileSync(path.join(outputPath, `${options.saveFilename}.png`), imageBuffer);
      console.log(`PDF is now converted to a single image`);
    })
    .catch(error => {
      // console.log(error);
    });
    await holdExecution(); // Wait for 2 seconds
    // Converted image 
    const imagePath = path.join(outputPath, `${options.saveFilename}.1.png`);
    console.log("Read file path", imagePath);
    const buffer = fs.readFileSync(imagePath);
    
    // Assuming Jimp.read returns a Promise
    const image = await Jimp.read(buffer);

    const value = jsQR(image.bitmap.data, image.bitmap.width, image.bitmap.height);
    if (value) {
        // Call your other function here and pass value.result to it
        const certificateInfo = extractCertificateInfo(value.data);
        return certificateInfo;
    } else {
        // console.log('No QR code found in the image.');
        throw new Error("QR Code not found in image.");
        return;
    }

  } catch (error) {
      // Log and rethrow any errors that occur during the process
      console.error(error);
      throw error;
  }
};

const holdExecution = () => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, 2500); // 2000 milliseconds = 2 seconds
  });
};

const _extractQRCodeDataFromPDF = async (pdfFilePath) => {
  try {
      const pdf2picOptions = {
          quality: 100,
          density: 300,
          format: "png",
          width: 2000,
          height: 2000,
    };
    
      /**
       * Initialize PDF to image conversion by supplying a file path
       */
      const base64Response = await fromPath(pdfFilePath, pdf2picOptions)(
          1, // page number to be converted to image
          true // returns base64 output
    );

    // Extract base64 data URI from response
      const dataUri = base64Response?.base64;

      // Throw error if base64 data URI is not available
      if (!dataUri)
          throw new Error("PDF could not be converted to Base64 string");

      // Convert base64 string to buffer
      const buffer = Buffer.from(dataUri, "base64");
      // Read PNG data from buffer
      const png = PNG.sync.read(buffer);

      // Decode QR code from PNG data
      const code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
      const qrCodeText = code?.data;

      // Throw error if QR code text is not available
      if (!qrCodeText)
          throw new Error("QR Code Text could not be extracted from PNG image");

      detailsQR = qrCodeText;

      // Extract certificate information from QR code text
      const certificateInfo = extractCertificateInfo(qrCodeText);

      // Return the extracted certificate information
      return certificateInfo;
  } catch (error) {
      // Log and rethrow any errors that occur during the process
      console.error(error);
      throw error;
  }
};

const addLinkToPdf = async (
  inputPath, // Path to the input PDF file
  outputPath, // Path to save the modified PDF file
  linkUrl, // URL to be added to the PDF
  qrCode, // QR code image to be added to the PDF
  combinedHash // Combined hash value to be displayed (optional)
) => {
    // Read existing PDF file bytes
    const existingPdfBytes = fs.readFileSync(inputPath);

    // Load existing PDF document
    const pdfDoc = await pdf.PDFDocument.load(existingPdfBytes);

    // Get the first page of the PDF document
    const page = pdfDoc.getPage(0);

    // Get page width and height
    const width = page.getWidth();
    const height = page.getHeight();

    // Add link URL to the PDF page
    page.drawText(linkUrl, {
      x: 62, // X coordinate of the text
      y: 30, // Y coordinate of the text
      size: 8, // Font size
  });

    // page.drawText(combinedHash, {
    //   x: 5,
    //   y: 10,
    //   size: 3
    // });

    //Adding qr code
    const pdfDc = await PDFDocument.create();
    // Adding QR code to the PDF page
    const pngImage = await pdfDoc.embedPng(qrCode); // Embed QR code image
    const pngDims = pngImage.scale(0.31); // Scale QR code image

    page.drawImage(pngImage, {
        x: width - pngDims.width - 117,
        y: 135,
        width: pngDims.width,
        height: pngDims.height,
    });
    qrX = width - pngDims.width - 75;
    qrY = 75;
    qrWidth = pngDims.width;
    qrHeight = pngDims.height;

    pdfBytes = await pdfDoc.save();

    fs.writeFileSync(outputPath, pdfBytes);
    return pdfBytes;
};

// Function to calculate SHA-256 hash of data
const calculateHash = (data)=> {
  // Create a hash object using SHA-256 algorithm
  // Update the hash object with input data and digest the result as hexadecimal string
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Function to create a new instance of Web3 and connect to a specified RPC endpoint
const web3i = async () => {
    // Create a new Web3 instance with the specified RPC endpoint
    const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      process.env.RPC_ENDPOINT
    )
  );

  try {
    // Check if the RPC endpoint is valid by checking if the node is listening
    const validateEndPoint = await web3.eth.net.isListening();
    if(!validateEndPoint){
      return null; // Return null if the endpoint is not valid
    }

    // Get contract ABI from configuration
    const contractABI = abi;
    // Create a new contract instance using the ABI and contract address
    const contract = await new web3.eth.Contract(contractABI, contractAddress);
    return contract; // Return the contract instance

  } catch (error) {
    console.log("Invalid Endpoint", error);
  }
};

const confirm = async (tx) => {
  // Create a new instance of Web3 and connect to the RPC endpoint
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      process.env.RPC_ENDPOINT
    )
  );

  // Get the current gas price from the network
  const gasPrice = await web3.eth.getGasPrice();

  // Encode the transaction data
  const encodedTx = tx.encodeABI();

  // Get the current nonce (transaction count) for the sender account
  const nonce = await web3.eth.getTransactionCount(account);

  // Set a gas limit for the transaction
  const gasLimit = 1000000;

  // Construct the transaction object
  const transactionObject = {
    nonce: web3.utils.toHex(nonce), // Convert nonce to hexadecimal
    from: account, // Sender account
    to: contractAddress, // Contract address
    gasLimit: web3.utils.toHex(gasLimit), // Convert gas limit to hexadecimal
    gasPrice: web3.utils.toHex(gasPrice), // Convert gas price to hexadecimal
    data: encodedTx, // Encoded transaction data
  };

  // Sign the transaction using the sender's private key
  const signedTransaction = await web3.eth.accounts.signTransaction(
    transactionObject,
    process.env.PRIVATE_KEY // Sender's private key
  );

  // Send the signed transaction to the network
  const ok = await web3.eth.sendSignedTransaction(
    signedTransaction.rawTransaction
  );

  // Get the transaction hash
  hash = signedTransaction.transactionHash;

  return hash; // Return the transaction hash
};


const simulateIssueCertificate = async (certificateNumber, hash) => {
  // console.log("Passing hash & certiicate", certificateNumber, hash);
  // Replace with your actual function name and arguments
  // const functionName = 'issueCertificate';
  // const functionArguments = [certificateNumber, hash];
  try {
    // const result = await _contract.callStatic.issueCertificate(certificateNumber, hash);
    const result = await _contract.populateTransaction.issueCertificate(certificateNumber, hash);
    // const gasEstimate = await _contract.estimateGas[functionName](...functionArguments);
    // console.log(`Estimated gas required for issueCertificate : `, gasEstimate.toString());

    // Extract data from the result
    const resultData = result.data;
    // Check if data exists (indicating success) and return true, otherwise return false
    if (resultData.length > 0) {
      return true; // Simulation successful
    } else {
      return false; // Simulation failed
    }
    } catch (e) {
      // Handle exceptions, such as CALL_EXCEPTION, indicating simulation failure
    if (e.code == ethers.errors.CALL_EXCEPTION) {
      console.log("Simulation failed for issue Certificate.");
      return false;
    }
  }
};

const simulateIssueBatchCertificates = async (hash) => {
  // Replace with your actual function name and arguments
  const functionName = 'formRoot';
  const functionArguments = [hash];
  try {
    const result = await _contract.populateTransaction.issueBatchOfCertificates(hash);

    // const gasEstimate = await _contract.estimateGas[functionName](...functionArguments);
    // console.log(`Estimated gas required for issueBatchCertificate : `, gasEstimate.toString());
    const resultData = result.data;
    if (resultData.length > 0) {
      return true;
    } else {
      return false;
    }
    } catch (e) {
    if (e.code == ethers.errors.CALL_EXCEPTION) {
      console.log("Simulation failed for issue BatchCertificates.");
      return false;
    }
  }
};

const simulateTrustedOwner = async (contractFunction, address) => {
  // Replace with your actual function name and arguments
  const functionArguments = [address];
  try {
    // const result = await _contract.callStatic.issueCertificate(certificateNumber, hash);
    // Determine the function to simulate based on the provided contractFunction parameter
    if (functionName == 'addTrustedOwner') {
      
      var functionName = 'addTrustedOwner';
      var result = await _contract.populateTransaction.addTrustedOwner(address);
    } else {
      var functionName = 'removeTrustedOwner';
      var result = await _contract.populateTransaction.removeTrustedOwner(address);
    }

    // const gasEstimate = await _contract.estimateGas[functionName](...functionArguments);
    // console.log(`Estimated gas required for issueCertificate : `, gasEstimate.toString());
    // Extract data from the result
    const resultData = result.data;

    // Check if data exists (indicating success) and return true, otherwise return false
    if (resultData.length > 0) {
      return true; // Simulation successful
    } else {
      return false; // Simulation failed
    }
    } catch (e) {
    // Handle exceptions, such as CALL_EXCEPTION, indicating simulation failure
    if (e.code == ethers.errors.CALL_EXCEPTION) {
      console.log("Simulation failed for Trusted Owner.");
      return false; // Simulation failed
    }
  }
};


const fileFilter = (req, file, cb) => {
  // Check if the file MIME type is a PDF
  if (file.mimetype === "application/pdf") {
    cb(null, true); // Accept the file
  } else {
    // If the file type is not PDF, reject the file upload with an error message
    cb(
      new Error("Invalid file type. Only JPEG and PNG files are allowed."),
      false
    );
  }
};

const excelFilter = (req, file, cb) => {
  if (file.mimetype === "application/vnd.ms-excel" || file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only Excel files (XLS, XLSX) are allowed."),
      false
    );
  }
};

const cleanUploadFolder = async () => {
  const uploadFolder = '/uploads'; // Specify the folder path you want
  const folderPath = path.join(__dirname, '..', uploadFolder);

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
};

const isDBConnected = async () => {
  try {
    // Attempt to establish a connection to the MongoDB database using the provided URI
    await mongoose.connect(utils.MONGODB_URI);
    return true; // Return true if the connection is successful
  } catch (error) {
    console.log(error); // Log any errors that occur during the connection attempt
    return false; // Return false if there's an error connecting to the database
  }
};


// Email Approved Notfication function
const sendEmail = async (name, email) => {
  // Log the details of the email recipient (name and email address)
  // console.log("Details", name, email);
  try {
      // Update the mailOptions object with the recipient's email address and email body
      mailOptions.to = email;
      mailOptions.text = `Hi ${name}, 
Congratulations! You've been approved by the admin. 
You can now log in to your profile. With username ${email}`;
  
      // Send the email using the configured transporter
      transporter.sendMail(mailOptions);
      console.log('Email sent successfully');

      // Return true to indicate that the email was sent successfully
      return true;
  } catch (error) {
      // Log an error message if there was an error sending the email
      console.error('Error sending email:', error);

      // Return false to indicate that the email sending failed
      return false;
  }
};

// Email Rejected Notfication function
const rejectEmail = async (name, email) => {
  // console.log("Details", name, email);
  try {
      // Update the mailOptions object with the recipient's email address and email body
      mailOptions.to = email;
      mailOptions.text = `Hi ${name}, 
      We regret to inform you that your account registration has been declined by the admin. 
      If you have any questions or concerns, please feel free to contact us. 
      Thank you for your interest.`;
  
      // Send the email using the configured transporter
      transporter.sendMail(mailOptions);
      console.log('Email sent successfully');

      // Return true to indicate that the email was sent successfully
      return true;
  } catch (error) {
      // Log an error message if there was an error sending the email
      console.error('Error sending email:', error);

      // Return false to indicate that the email sending failed
      return false;
  }
};


module.exports = {
  // Fetch & validate excel file records
  fetchExcelRecord,

  // Function to insert certificate data into MongoDB
  insertCertificateData,

  // Insert Batch certificate data into Database
  insertBatchCertificateData,

  // Function to extract certificate information from a QR code text
  extractCertificateInfo,

  // Function to extract QR code data from a PDF file
  extractQRCodeDataFromPDF,

  // Function to add a link and QR code to a PDF file
  addLinkToPdf,

  // Function to calculate the hash of data using SHA-256 algorithm
  calculateHash,

  // Function to initialize and return a web3 instance
  web3i,

  // Function to confirm and send a transaction on the Ethereum blockchain
  confirm,

  // Function for filtering file uploads based on MIME type Pdf
  fileFilter,

  // Function for filtering file uploads based on MIME type Excel
  excelFilter,

  // Function to simulate adding or removing a trusted owner
  simulateTrustedOwner,

  // Function to simulate issuing a certificate
  simulateIssueCertificate,

  // Function to simulate Batch issuing a certificate
  simulateIssueBatchCertificates,

  // Function to clean up the upload folder
  cleanUploadFolder,

  // Function to check if MongoDB is connected
  isDBConnected,

  // Function to send an email (approved)
  sendEmail,

  // Function to send an email (rejected)
  rejectEmail
};
