// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const crypto = require('crypto'); // Module for cryptographic functions
const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;
const fs = require("fs"); // File system module
const path = require("path"); // Module for working with file paths
const { fromPath } = require("pdf2pic"); // Converter from PDF to images
const { PNG } = require("pngjs"); // PNG image manipulation library
const jsQR = require("jsqr"); // JavaScript QR code reader
const ethers = require("ethers"); // Ethereum JavaScript library
const mongoose = require("mongoose"); // MongoDB object modeling tool
const nodemailer = require('nodemailer'); // Module for sending emails
const moment = require('moment');

const { decryptData } = require("../common/cryptoFunction"); // Custom functions for cryptographic operations

const retryDelay = parseInt(process.env.TIME_DELAY);
const maxRetries = 3; // Maximum number of retries
const urlLimit = parseInt(process.env.MAX_URL_SIZE) || parseInt(50);

// Regular expression to match MM/DD/YY format
const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
const excludeUrlContent = "/verify-documents";

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

// Define an array of providers to use as fallbacks
const providers = [
  new ethers.AlchemyProvider(process.env.RPC_NETWORK, process.env.ALCHEMY_API_KEY),
  new ethers.InfuraProvider(process.env.RPC_NETWORK, process.env.INFURA_API_KEY)
  // Add more providers as needed
];

// Create a new FallbackProvider instance
const fallbackProvider = new ethers.FallbackProvider(providers);

// Create a new ethers wallet instance using the private key from environment variable and the provider
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract ABI and wallet)
const sim_contract = new ethers.Contract(contractAddress, abi, signer);

// Import the Issues models from the schema defined in "../config/schema"
const { User, Issues, BatchIssues, IssueStatus, VerificationLog, ShortUrl, DynamicIssues, ServiceAccountQuotas } = require("../config/schema");

//Connect to polygon
const connectToPolygon = async () => {
  try {
    const provider = new ethers.FallbackProvider(providers);
    await provider.getNetwork(); // Attempt to detect the network
    return provider;

  } catch (error) {
    console.error('Failed to connect to Polygon node:', error.message);
    console.log(`Retrying connection in ${retryDelay / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait before retrying
    return connectToPolygon(providers); // Retry connecting recursively
  }
};

// Function to Scheduled update Service limit Quotas
const scheduledUpdateLimits = async () => {
  var fetchedQuotas;
  const todayDate = new Date();
  try {
    // Calculate the date scheduled days ago
    let scheduledDaysAgo = new Date();
    scheduledDaysAgo.setDate(scheduledDaysAgo.getDate() - schedule_days);

    const thresholdDate = new Date(scheduledDaysAgo);
    // Check mongo DB connection
    const dbStatus = await isDBConnected();
    if (dbStatus) {
      const getServiceQuotas = await ServiceAccountQuotas.find({
        resetAt: { $lt: thresholdDate },
        limit: { $lt: limitThreshold }
      });
      if (getServiceQuotas) {
        // Extracting required properties
        fetchedQuotas = getServiceQuotas.map(item => ({
          issuerId: item.issuerId,
          limit: item.limit,
          serviceId: item.serviceId,
          resetAt: item.resetAt
        }));
        try {
          // Update limit to quota and resetAt to today's date for each item
          for (let count = 0; count < fetchedQuotas.length; count++) {
            let getRecord = fetchedQuotas[count];
            let filter = { issuerId: getRecord.issuerId, serviceId: getRecord.serviceId };
            let newLimit = getRecord.limit > 0 ? (getRecord.limit + serviceLimit) : serviceLimit;
            // Update operation
            let updateDoc = {
              $set: { limit: newLimit, resetAt: todayDate } // Assuming you want to update 'resetAt' field
            };
            // Perform the update
            await ServiceAccountQuotas.updateOne(filter, updateDoc);
          }
        } catch (error) {
          console.error(messageCode.msgFailedToUpdateQuotas, error.message);
        }
      }
    }
  } catch (error) {
    console.error(messageCode.msgFailedToUpdateQuotas, error.message);
  }
};

// Function to get issuer limit
const getIssuerServiceCredits = async (existIssuerId, serviceId) => {
  let getServiceLimit = await ServiceAccountQuotas.findOne({
    issuerId: existIssuerId,
    serviceId: serviceId
  });
  if (getServiceLimit && getServiceLimit.limit > 0) {
    if (getServiceLimit.status === false) {
      return true;
    }
    return getServiceLimit.limit;
  } else {
    return null;
  }
};

// Function to update issuer limit
const updateIssuerServiceCredits = async (existIssuerId, serviceId) => {
  let existServiceLimit = await ServiceAccountQuotas.findOne({
    issuerId: existIssuerId,
    serviceId: serviceId
  });
  let newLimit = existServiceLimit.limit > 1 ? existServiceLimit.limit - 1 : 0;
  existServiceLimit.limit = newLimit;
  await existServiceLimit.save();
};

// Function to convert the Date format
const convertDateFormat = async (dateString) => {
  if (dateString == 1 || dateString == '1') {
    return "1";
  }
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

  var formatString = 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ';
  // Define the possible date formats
  const formats = ['ddd MMM DD YYYY HH:mm:ss [GMT]ZZ', 'M/D/YY', 'M/D/YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD MMMM, YYYY', 'DD MMM, YYYY', 'MMMM d, yyyy', 'MM/DD/YY'];

  // Attempt to parse the input date string using each format
  let dateObject;
  for (const format of formats) {
    dateObject = moment(dateString, format, true);
    if (dateObject.isValid()) {
      break;
    }
  }

  // Check if a valid date object was obtained
  if (dateObject && dateObject.isValid()) {

    // Convert the dateObject to moment (if it's not already)
    const momentDate = moment(dateObject);

    // Format the date to 'YY/MM/DD'
    var formattedDate = momentDate.format('MM/DD/YYYY');
    return formattedDate;
  } else if (!formattedDate) {
    // Format the parsed date to 'MM/DD/YY'
    var formattedDate = moment(dateString, formatString).format('MM/DD/YYYY');
    if (formattedDate != 'Invalid date') {
      return formattedDate;
    } else {
      var formattedDate = moment(dateString).utc().format('MM/DD/YYYY');
      return formattedDate;
    }
  }
  else {
    // Return null or throw an error based on your preference for handling invalid dates
    return null;
  }
};

// Convert Date format for the Display on Verification
const convertDateOnVerification = async (dateString) => {

  if (dateString != 1) {
    var formatString = 'MM/DD/YYYY';

    // Attempt to parse the input date string using the specified format
    const dateObject = moment(dateString, formatString, true);
    if (dateObject.isValid()) {
      // Format the date to 'MM/DD/YYYY'
      var formattedDate = moment(dateObject).format(formatString);
      return formattedDate;
    }
  } else if (dateString == 1) {
    return dateString;
  }

};

// Function to convert MM/DD/YY to epoch date format
const convertDateToEpoch = async (dateString) => {

  if (dateString != 1) {

    // Split the date string into month, day, and year
    const [month, day, year] = dateString.split('/');

    // Create a new Date object with the provided date components
    const dateObject = new Date(`${month}/${day}/${year}`);

    // Get the Unix timestamp (epoch value) by calling getTime() method
    const epochValue = dateObject.getTime() / 1000; // Convert milliseconds to seconds

    return epochValue;

  } else if (dateString == 1) {
    return dateString
  } else {
    return false;
  }
};

const convertEpochToDate = async (epochTimestamp) => {
  if (!epochTimestamp || epochTimestamp == 0) {
    return false;
  } else if (epochTimestamp == 1) {
    return epochTimestamp;
  } else {
    // Create a new Date object with the epoch timestamp (in milliseconds)
    const regularIntValue = parseInt(epochTimestamp.toString());
    const dateObject = new Date(regularIntValue * 1000); // Convert seconds to milliseconds

    // Extract the month, day, and year components from the date object
    const month = String(dateObject.getMonth() + 1).padStart(2, '0'); // Month starts from 0
    const day = String(dateObject.getDate()).padStart(2, '0');
    const year = String(dateObject.getFullYear()).slice(-4); // Get last 4 digits of the year

    // Construct the MM/DD/YY date format string
    const dateString = `${month}/${day}/${year}`;
    return dateString;
  }
};

const convertExpirationStatusLog = async (_date) => {
  if (_date == "1" || _date == null) {
    return "1";
  }
  // Parse the date string into a Date object
  const dateParts = (_date).split('/');
  const year = parseInt(dateParts[4]) + 2000; // Assuming 4-digit year represents 2000s
  const month = parseInt(dateParts[0]) - 1; // Months are zero-indexed
  const day = parseInt(dateParts[1]);
  // Create a Date object
  const date = new Date(year, month, day);
  // Format the date in ISO 8601 format with UTC offset
  return date.toISOString();
};

// Verify Certification ID from both collections (single / batch)
const isCertificationIdExisted = async (certId) => {
  const dbStaus = await isDBConnected();

  if (certId == null || certId == "") {
    return null;
  }

  const singleIssueExist = await Issues.findOne({ certificateNumber: certId });
  const batchIssueExist = await BatchIssues.findOne({ certificateNumber: certId });

  try {
    if (singleIssueExist) {

      return singleIssueExist;
    } else if (batchIssueExist) {

      return batchIssueExist;
    } else {

      return null;
    }

  } catch (error) {
    console.error("Error during validation:", error);
    return null;
  }
};

// Function to insert url data into DB
const insertUrlData = async (data) => {
  if (!data) {
    console.log("invaid data sent to store in DB");
    return false;
  }
  try {
    isDBConnected();
    // Store new url details fro provided data
    const newUrlData = new ShortUrl({
      email: data.email,
      certificateNumber: data.certificateNumber,
      url: data.url
    });
    // Save the new shortUrl document to the database
    const result = await newUrlData.save();

    // Logging confirmation message
    console.log("URL data inserted");
    return true;

  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error("Error connecting in update URL data", error);
    return false;
  }
};

// Function to insert certification data into MongoDB
const insertCertificateData = async (data) => {
  try {
    // Create a new Issues document with the provided data
    const newIssue = new Issues({
      issuerId: data.issuerId,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      course: data.course,
      grantDate: data.grantDate,
      expirationDate: data.expirationDate,
      certificateStatus: data.certStatus,
      url: data.url || '',
      type: data.type || '',
      issueDate: Date.now() // Set the issue date to the current timestamp
    });

    // Save the new Issues document to the database
    const result = await newIssue.save();

    const updateIssuerLog = await insertIssueStatus(data);

    const idExist = await User.findOne({ issuerId: data.issuerId });
    if (idExist.certificatesIssued == undefined) {
      idExist.certificatesIssued = 0;
    }
    // If user with given id exists, update certificatesIssued count
    const previousCount = idExist.certificatesIssued || 0; // Initialize to 0 if certificatesIssued field doesn't exist
    idExist.certificatesIssued = previousCount + 1;
    await idExist.save(); // Save the changes to the existing user


    // Logging confirmation message
    console.log("Certificate data inserted");
  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error("Error connecting to MongoDB:", error);
  }
};

// Function to insert certification data into MongoDB
const insertDynamicCertificateData = async (data) => {
  try {
    // Create a new Issues document with the provided data
    const newDynamicIssue = new DynamicIssues({
      issuerId: data.issuerId,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      certificateStatus: 1,
      certificateFields: data.customFields,
      type: 'dynamic',
      issueDate: Date.now() // Set the issue date to the current timestamp
    });

    // Save the new Issues document to the database
    const result = await newDynamicIssue.save();

    const idExist = await User.findOne({ issuerId: data.issuerId });
    if (idExist.certificatesIssued == undefined) {
      idExist.certificatesIssued = 0;
    }
    // If user with given id exists, update certificatesIssued count
    const previousCount = idExist.certificatesIssued || 0; // Initialize to 0 if certificatesIssued field doesn't exist
    idExist.certificatesIssued = previousCount + 1;
    await idExist.save(); // Save the changes to the existing user

    // Logging confirmation message
    console.log("Certificate data inserted");
  } catch (error) {
    // Handle errors related to database connection or insertion
    console.error("Error connecting to MongoDB:", error);
  }
};


// Function to insert certification data into MongoDB
const insertBatchCertificateData = async (data) => {
  try {
    // Insert data into MongoDB
    const newBatchIssue = new BatchIssues({
      issuerId: data.issuerId,
      batchId: data.batchId,
      proofHash: data.proofHash,
      encodedProof: data.encodedProof,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      course: data.course,
      grantDate: data.grantDate,
      expirationDate: data.expirationDate,
      certificateStatus: data.certStatus,
      issueDate: Date.now()
    });

    const result = await newBatchIssue.save();

    const updateIssuerLog = await insertIssueStatus(data);

    const idExist = await User.findOne({ issuerId: data.issuerId });

    // If user with given id exists, update certificatesIssued count
    const previousCount = idExist.certificatesIssued || 0; // Initialize to 0 if certificatesIssued field doesn't exist
    idExist.certificatesIssued = previousCount + 1;
    await idExist.save(); // Save the changes to the existing user

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

// Function to store issues log in the DB
const insertIssueStatus = async (issueData) => {
  if (issueData) {
    // Format the date in ISO 8601 format with UTC offset
    // const statusDate = await convertExpirationStatusLog(issueData.expirationDate);
    // Parsing input date using moment
    const parsedDate = issueData.expirationDate != '1' ? moment(issueData.expirationDate, 'MM/DD/YYYY') : '1';
    // Formatting the parsed date into ISO 8601 format with timezone
    const formattedDate = parsedDate != '1' ? parsedDate.toISOString() : '1';
    // Check if issueData.batchId is provided, otherwise assign null
    const batchId = issueData.batchId || null;
    const email = issueData.email || null;
    const issuerId = issueData.issuerId || null;
    const transactionHash = issueData.transactionHash || null;

    // Insert data into status MongoDB
    const newIssueStatus = new IssueStatus({
      email: email,
      issuerId: issuerId, // ID field is of type String and is required
      batchId: batchId,
      transactionHash: transactionHash, // TransactionHash field is of type String and is required
      certificateNumber: issueData.certificateNumber, // CertificateNumber field is of type String and is required
      course: issueData.course,
      name: issueData.name,
      expirationDate: formattedDate, // ExpirationDate field is of type String and is required
      certStatus: issueData.certStatus,
      lastUpdate: Date.now()
    });
    const updateLog = await newIssueStatus.save();
  }
};

const verificationLogEntry = async (verificationData) => {
  if (verificationData) {
    var dbStatus = await isDBConnected();
    if (dbStatus) {
      var isIssuerExist = await User.findOne({ issuerId: verificationData.issuerId });
      if (isIssuerExist) {

        try {
          // Find or create the verification log for the user
          const filter = { email: isIssuerExist.email };
          const update = {
            $setOnInsert: { // Set fields if the document is inserted
              email: isIssuerExist.email,
              issuerId: verificationData.issuerId,
            },
            $set: { // Update the lastUpdate field
              lastUpdate: Date.now(),
            },
            $inc: { // Increment the count for the course or initialize it to 1 if it doesn't exist
              [`courses.${verificationData.course}`]: 1,
            }
          };
          const options = {
            upsert: true, // Create a new document if it doesn't exist
            new: true, // Return the updated document
            useFindAndModify: false, // To use findOneAndUpdate() without deprecation warning
          };

          var updatedDocument = await VerificationLog.findOneAndUpdate(filter, update, options);

          // console.log('Document updated:', updatedDocument);

        } catch (error) {
          console.error("Internal server error", error);
        }
      } else if (verificationData.issuerId == "default") {

        try {
          // Find or create the verification log for the user
          const filter = { email: verificationData.issuerId };
          const update = {
            $setOnInsert: { // Set fields if the document is inserted
              email: verificationData.issuerId,
              issuerId: verificationData.issuerId,
            },
            $set: { // Update the lastUpdate field
              lastUpdate: Date.now(),
            },
            $inc: { // Increment the count for the course or initialize it to 1 if it doesn't exist
              [`courses.${verificationData.course}`]: 1,
            }
          };
          const options = {
            upsert: true, // Create a new document if it doesn't exist
            new: true, // Return the updated document
            useFindAndModify: false, // To use findOneAndUpdate() without deprecation warning
          };

          var updatedDocument = await VerificationLog.findOneAndUpdate(filter, update, options);

          // console.log('Document updated:', updatedDocument);

        } catch (error) {
          console.error("Internal server error", error);
        }
      }
    }
  }
};

// Function to extract certificate information from a QR code text
const extractCertificateInfo = async (qrCodeText) => {
  // console.log("QR Code Text", qrCodeText);
  var _qrCodeText = qrCodeText;
  var urlData = null;
  // Check if the data starts with 'http://' or 'https://'
  if (qrCodeText.startsWith('http://') || qrCodeText.startsWith('https://')) {
    var responseLength = qrCodeText.length;
    // Parse the URL
    let parsedUrl = new URL(_qrCodeText);
    // Check if the pathname contains 'verify-documents'
    if (parsedUrl.pathname.includes(excludeUrlContent)) {
      // Remove 'verify-documents' from the pathname
      parsedUrl.pathname = parsedUrl.pathname.replace(excludeUrlContent, '/');
      // Reconstruct the modified URL
      _qrCodeText = parsedUrl.toString();
    }
    // console.log("The modified QR", _qrCodeText);
    // If it's an encrypted URL, extract the query string parameters q and iv
    const url = decodeURIComponent(_qrCodeText);
    const qIndex = url.indexOf("q=");
    const ivIndex = url.indexOf("iv=");
    const q = url.substring(qIndex + 2, ivIndex - 1);
    const iv = url.substring(ivIndex + 3);

    // Decrypt the data using the provided q and iv parameters
    const fetchDetails = decryptData(q, iv);

    // Parse the JSON string into a JavaScript object
    const parsedData = JSON.parse(fetchDetails);
    // console.log("Parsed Details", parsedData);
    if (parsedData.customFields != undefined) {
      // Create a new object with desired key-value mappings for certificate information
      var convertedData = {
        "Certificate Number": parsedData.Certificate_Number,
        "Name": parsedData.name,
        "Custom Fields": parsedData.customFields,
        "Polygon URL": parsedData.polygonLink
      };
      // console.log("Data of Redirect", convertedData);
      return [convertedData, _qrCodeText];
    }
    // Create a new object with desired key-value mappings for certificate information
    var convertedData = {
      "Certificate Number": parsedData.Certificate_Number,
      "Name": parsedData.name,
      "Course Name": parsedData.courseName,
      "Grant Date": parsedData.Grant_Date,
      "Expiration Date": parsedData.Expiration_Date,
      "Polygon URL": parsedData.polygonLink
    };
    // console.log("Data of Redirect", convertedData);
    return [convertedData, _qrCodeText];
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
        if (key === "Verify On Blockchain") {
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
    var convertedCertData = {
      "Certificate Number": certificateInfo["Certificate Number"],
      "Name": certificateInfo["Name"],
      "Course Name": certificateInfo["Course Name"],
      "Grant Date": certificateInfo['Grant Date'],
      "Expiration Date": certificateInfo['Expiration Date'],
      "Polygon URL": certificateInfo["Polygon URL"]
    };
    return [convertedCertData, urlData];
  }
};

const holdExecution = (delay) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, delay); // If 1500 milliseconds = 1.5 seconds
  });
};

const baseCodeResponse = async (pdfFilePath, pdf2PicOptions) => {

  var base64Response = await fromPath(pdfFilePath, pdf2PicOptions)(
    1, // page number to be converted to image
    true // returns base64 output
  );

  // Extract base64 data URI from response
  var dataUri = base64Response?.base64;

  // Convert base64 string to buffer
  var buffer = Buffer.from(dataUri, "base64");
  // Read PNG data from buffer
  var png = PNG.sync.read(buffer);

  // Decode QR code from PNG data
  return _code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);

};

const extractQRCodeDataFromPDF = async (pdfFilePath) => {
  try {
    const pdf2picOptions = {
      quality: 100,
      density: 300,
      format: "png",
      width: 2000,
      height: 2000,
    };

    const pdf2picOptions2 = {
      quality: 100,
      density: 350,
      format: "png",
      width: 3000,
      height: 3000,
    };

    const pdf2picOptions3 = {
      quality: 100,
      density: 400,
      format: "png",
      width: 4000,
      height: 4000,
    };

    // Decode QR code from PNG data
    var code = await baseCodeResponse(pdfFilePath, pdf2picOptions);
    if (!code) {
      var code = await baseCodeResponse(pdfFilePath, pdf2picOptions2);
      if (!code) {
        var code = await baseCodeResponse(pdfFilePath, pdf2picOptions3);
      }
    }
    const qrCodeText = code?.data;
    // Throw error if QR code text is not available
    if (!qrCodeText) {
      // throw new Error("QR Code Text could not be extracted from PNG image");
      console.log("QR Code Not Found / QR Code Text could not be extracted");
      return false;
    } else {
      detailsQR = qrCodeText;
      // Extract certificate information from QR code text
      // const certificateInfo = extractCertificateInfo(qrCodeText);

      // Return the extracted certificate information
      return qrCodeText;
    }

  } catch (error) {
    // Log and rethrow any errors that occur during the process
    console.error(error);
    // throw error;
    return false;
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

  //Adding qr code
  const pdfDc = await PDFDocument.create();
  // Adding QR code to the PDF page
  const pngImage = await pdfDoc.embedPng(qrCode); // Embed QR code image
  const pngDims = pngImage.scale(0.36); // Scale QR code image

  page.drawImage(pngImage, {
    x: width - pngDims.width - 108,
    y: 135,
    width: pngDims.width,
    height: pngDims.height,
  });
  qrX = width - pngDims.width - 75;
  qrY = 75;
  qrWidth = pngDims.width;
  qrHeight = pngDims.height;

  const pdfBytes = await pdfDoc.save();

  fs.writeFileSync(outputPath, pdfBytes);
  return pdfBytes;
};

const addDynamicLinkToPdf = async (
  inputPath, // Path to the input PDF file
  outputPath, // Path to save the modified PDF file
  linkUrl, // URL to be added to the PDF
  qrCode, // QR code image to be added to the PDF
  combinedHash, // Combined hash value to be displayed (optional)
  positionHorizontal,
  positionVertical
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
  // page.drawText(linkUrl, {
  //   x: 62, // X coordinate of the text
  //   y: 30, // Y coordinate of the text
  //   size: 8, // Font size
  // });

  //Adding qr code
  const pdfDc = await PDFDocument.create();
  // Adding QR code to the PDF page
  const pngImage = await pdfDoc.embedPng(qrCode); // Embed QR code image
  const pngDims = pngImage.scale(1); // Scale QR code image

  page.drawImage(pngImage, {
    x: positionHorizontal,
    y: height - (positionVertical + pngDims.height),
    width: pngDims.width,
    height: pngDims.height,
  });
  console.log("Width X Height", width, height);

  qrX = width - pngDims.width - 75;
  qrY = 75;
  qrWidth = pngDims.width;
  qrHeight = pngDims.height;

  const pdfBytes = await pdfDoc.save();

  fs.writeFileSync(outputPath, pdfBytes);
  return pdfBytes;
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

  // Assuming PDF resolution is 72 points per inch
  // const dpi = 72;
  // const widthInches = width / dpi;
  // const heightInches = height / dpi;

  // Convert inches to millimeters (1 inch = 25.4 mm)
  // const widthMillimeters = widthInches * 25.4;
  // const heightMillimeters = heightInches * 25.4;

  // Convert inches to pixels (assuming 1 inch = 96 pixels)
  // const widthPixels = widthInches * 96;
  // const heightPixels = heightInches * 96;
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

const verifyPDFDimensions = async (pdfPath) => {
  // Extract QR code data from the PDF file
  const certificateData = await extractQRCodeDataFromPDF(pdfPath);
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  const firstPage = pdfDoc.getPages()[0];
  const { width, height } = firstPage.getSize();

  // Assuming PDF resolution is 72 points per inch
  const dpi = 72;
  const widthInches = width / dpi;
  const heightInches = height / dpi;

  // Convert inches to millimeters (1 inch = 25.4 mm)
  const widthMillimeters = widthInches * 25.4;
  const heightMillimeters = heightInches * 25.4;

  // Check if dimensions fall within the specified ranges
  if (
    (widthMillimeters >= 340 && widthMillimeters <= 360) &&
    (heightMillimeters >= 240 && heightMillimeters <= 260) &&
    (certificateData === false)
  ) {
    // Convert inches to pixels (assuming 1 inch = 96 pixels)
    // const widthPixels = widthInches * 96;
    // const heightPixels = heightInches * 96;

    // console.log("The certificate width x height (in mm):", widthMillimeters, heightMillimeters);

    return true;
  } else {
    // throw new Error('PDF dimensions must be within 240-260 mm width and 340-360 mm height');
    return false;
  }

};

// Function to calculate SHA-256 hash of data
const calculateHash = (data) => {
  // Create a hash object using SHA-256 algorithm
  // Update the hash object with input data and digest the result as hexadecimal string
  return crypto.createHash('sha256').update(data).digest('hex').toString();
};

// Function to create a new instance of Web3 and connect to a specified RPC endpoint
const web3i = async () => {
  var provider = new ethers.providers.getDefaultProvider(process.env.RPC_ENDPOINT);
  await provider.getNetwork(); // Attempt to detect the network

  if (provider) {

    // Get contract ABI from configuration
    const contractABI = abi;
    var signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    // Create a new contract instance using the ABI and contract address
    const contract = new ethers.Contract(contractAddress, contractABI, signer);
    return contract; // Return the contract instance

  } else {
    // console.log("Invalid Endpoint");
    return false;
  }
};

const fileFilter = (req, file, cb) => {
  // Check if the file MIME type is a PDF
  if (file.mimetype === "application/pdf") {
    cb(null, true); // Accept the file
  } else {
    // If the file type is not PDF, reject the file upload with an error message
    cb(
      new Error("Invalid file type. Only PDF files are allowed."),
      false
    );
  }
};

const cleanUploadFolder = async () => {
  const uploadFolder = '../uploads'; // Specify the folder path you want
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
  let retryCount = 0; // Initialize retry count
  while (retryCount < maxRetries) {
    try {
      // Attempt to establish a connection to the MongoDB database using the provided URI
      await mongoose.connect(process.env.MONGODB_URI);
      // console.log('Connected to MongoDB successfully!');
      return true; // Return true if the connection is successful
    } catch (error) {
      console.error('Error connecting to MongoDB:', error.message);
      retryCount++; // Increment retry count
      console.log(`Retrying connection (${retryCount}/${maxRetries}) in 1.5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait for 1.5 seconds before retrying
    }
  }
  console.error('Failed to connect to MongoDB after maximum retries.');
  return false; // Return false if unable to connect after maximum retries
};

// Email Approved Notfication function
const sendEmail = async (name, email) => {
  // Log the details of the email recipient (name and email address)
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

// Function to generate a new Ethereum account with a private key
const generateAccount = async () => {
  try {
    const id = crypto.randomBytes(32).toString('hex');
    const privateKey = "0x" + id;
    const wallet = new ethers.Wallet(privateKey);
    const addressWithoutPrefix = wallet.address; // Remove '0x' from the address
    // const addressWithoutPrefix = wallet.address.substring(2); // Remove '0x' from the address
    return addressWithoutPrefix;
    // return wallet.address;
  } catch (error) {
    console.error("Error generating Ethereum account:", error);
    // throw error; // Re-throw the error to be handled by the caller
    return null;
  }
};

const getCertificationStatus = async (certStatus) => {
  var inputStatus = parseInt(certStatus);
  switch (inputStatus) {
    case 0:
      return "Not Issued";
    case 1:
      return "Issued";
    case 2:
      return "Renewed";
    case 3:
      return "Revoked";
    case 4:
      return "Reactivated";
    case 5:
      return "Expired";
    case 6:
      return "Verified";
    default:
      return "Unknown";
  };
};

module.exports = {
  // Connect to Polygon 
  connectToPolygon,

  // Verify Certification ID from both collections (single / batch)
  isCertificationIdExisted,

  // Function to insert certificate data into MongoDB
  insertCertificateData,

  insertDynamicCertificateData,

  // Insert Batch certificate data into Database
  insertBatchCertificateData,

  // Function to extract certificate information from a QR code text
  extractCertificateInfo,

  insertUrlData,

  // Function to convert the Date format MM/DD/YYYY
  convertDateFormat,

  convertDateOnVerification,

  convertDateToEpoch,

  convertEpochToDate,

  insertIssueStatus,

  getCertificationStatus,

  verificationLogEntry,

  scheduledUpdateLimits,

  getIssuerServiceCredits,

  updateIssuerServiceCredits,

  // Function to extract QR code data from a PDF file
  extractQRCodeDataFromPDF,

  // Function to add a link and QR code to a PDF file
  addLinkToPdf,

  addDynamicLinkToPdf,

  //Verify the uploading pdf template dimensions
  verifyPDFDimensions,

  verifyDynamicPDFDimensions,

  // Function to calculate the hash of data using SHA-256 algorithm
  calculateHash,

  // Function to initialize and return a web3 instance
  web3i,

  // Function for filtering file uploads based on MIME type Pdf
  fileFilter,

  // Function to clean up the upload folder
  cleanUploadFolder,

  // Function to check if MongoDB is connected
  isDBConnected,

  // Function to send an email (approved)
  sendEmail,

  // Function to hold an execution for some time
  holdExecution,

  // Function to send an email (rejected)
  rejectEmail,

  // Function to generate a new Ethereum account with a private key
  generateAccount
};
