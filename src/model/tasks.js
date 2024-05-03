// Load environment variables from .env file
require('dotenv').config();

const crypto = require('node:crypto'); // Module for cryptographic functions
const path = require("path"); // Module for working with file paths
const fs = require("fs"); // File system module
const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument, rgb } = pdf;
const { createCanvas, loadImage } = require('canvas');
const QRCode = require("qrcode");
const { fromPath } = require("pdf2pic"); // Converter from PDF to images
const { PNG } = require("pngjs"); // PNG image manipulation library
const jsQR = require("jsqr"); // JavaScript QR code reader
const mongoose = require("mongoose"); // MongoDB object modeling tool
const { decryptData } = require("../utils/cryptoFunction"); // Custom functions for cryptographic operations

// Import MongoDB models
const { Issues, BatchIssues } = require("../utils/schema");
const maxRetries = 3; // Maximum number of retries
const retryDelay = parseInt(process.env.TIME_DELAY);

const cleanUploadFolder = async () => {
    const uploadFolder = '../uploads'; // Specify the folder path you want
    const folderPath = path.join(__dirname, '..', uploadFolder);
    // Check if the folder is not empty
    const filesInFolder = fs.readdirSync(folderPath);
  
    // if (filesInFolder.length > 0) {
    //   // Delete files in the folder
    //   filesInFolder.forEach(fileToDelete => {
    //     const filePathToDelete = path.join(folderPath, fileToDelete);
    //       try {
    //         fs.unlinkSync(filePathToDelete);
    //         console.log("Deleted file:", filePathToDelete);
    //       } catch (error) {
    //         console.error("Error deleting file:", filePathToDelete, error);
    //       }
    //   });
    // }

      const fileToDelete = filesInFolder[0]; // Get the first file in the folder
        const filePathToDelete = path.join(folderPath, fileToDelete); // Construct the full path of the file to delete

        // Delete the file
        fs.unlink(filePathToDelete, (err) => {
            if (err) {
                console.error(`Error deleting file "${filePathToDelete}":`, err);
            } else {
                console.log(`Only Files in "${filePathToDelete}" were deleted successfully.`);
          }
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
        density: 350,
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
        // detailsQR = qrCodeText;
        // Extract certificate information from QR code text
        // const certificateInfo = extractCertificateInfo(qrCodeText);
  
        // Return the extracted certificate information
        return true;
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
      // const pdfDc = await PDFDocument.create();
      // Adding QR code to the PDF page
      const pngImage = await pdfDoc.embedPng(qrCode); // Embed QR code image
      const pngDims = pngImage.scale(0.35); // Scale QR code image
  
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

const _addLinkToPdf = async (
  inputPath, // Path to the input PDF file
  outputPath, // Path to save the modified PDF file
  linkUrl, // URL to be added to the PDF
  qrCodeData, // QR code image to be added to the PDF
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
    const qrSize = 450; // Example size for QR code
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
      errorCorrectionLevel: "H", width: qrSize, height: qrSize
    });

    // Calculate dimensions of QR code
    const qrDims = { width: qrSize, height: qrSize };

     // Iterate over the page content
     const contentStream = page.getContentStream();
     const operators = contentStream.operators;
     let blankSpaces = [];
    // console.log("Page dims", page, width, height, qrDims);

    // const threshold = 255; // Threshold for white color (R, G, B values)
    // const minSpaceWidth = 100;
    // const minSpaceHeight = 100;

// for (let y = 0; y < height - minSpaceHeight; y++) {
//   for (let x = 0; x < width - minSpaceWidth; x++) {
//     const isSpaceFound = true; // Initialize flag

//     // Check pixel values within the 100x100 area
//     for (let dy = 0; dy < minSpaceHeight; dy++) {
//       for (let dx = 0; dx < minSpaceWidth; dx++) {
//         const pixel = page.getPixel(x + dx, y + dy);
//         if (pixel.r < threshold || pixel.g < threshold || pixel.b < threshold) {
//           isSpaceFound = false;
//           break; // Stop checking if a non-white pixel is found
//         }
//       }
//       if (!isSpaceFound) {
//         break; // Move to next row if space is not continuous
//       }
//     }

  //   if (isSpaceFound) {
  //     // Found a 100x100 free (white) space
  //     console.log(`Free space found at x: ${x}, y: ${y}`);
  //     break; // Stop searching after finding one space
  //   }
  // }
// }

    // for(let i = 0; i < operators.length; i++) {
    //   const op = operators[i];
    //   // Check if operation is for placing text or image
    //   if (op.name === 'TL' || op.name === 'Tj') {
    //     // Get coordinates and size of the text/image
    //     const x = op.args;
    //     console.log("operator found", x);
    //   }
    // }
  
    // Adding QR code to the PDF page
    const pngImage = await pdfDoc.embedPng(qrCodeImage); // Embed QR code image
    const pngDims = pngImage.scale(0.25); // Scale QR code image

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

// Function to calculate SHA-256 hash of data
const calculateHash = (data) => {
  // Create a hash object using SHA-256 algorithm
  // Update the hash object with input data and digest the result as hexadecimal string
  return crypto.createHash('sha256').update(data).digest('hex').toString();
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
      certificateStatus: 1,
      issueDate: Date.now() // Set the issue date to the current timestamp
    });

    // Save the new Issues document to the database
    const result = await newIssue.save();

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
      issueDate: Date.now()
    });

    const result = await newBatchIssue.save();
    // Logging confirmation message
    console.log("Batch Certificate data inserted");

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
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

  console.log("The certificate width x height (in mm):", widthMillimeters, heightMillimeters);

  // Check if dimensions fall within the specified ranges
  if (
    (widthMillimeters >= 340 && widthMillimeters <= 360) &&
    (heightMillimeters >= 240 && heightMillimeters <= 260) &&
    (certificateData === false)
  ) {
    // Convert inches to pixels (assuming 1 inch = 96 pixels)
    // const widthPixels = widthInches * 96;
    // const heightPixels = heightInches * 96;
    return true;
  } else {
    // throw new Error('PDF dimensions must be within 240-260 mm width and 340-360 mm height');
    return false;
  }

};

const holdExecution = (delay) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, delay); // If 1500 milliseconds = 1.5 seconds
  });
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

module.exports = {
// Function to clean up the upload folder
  cleanUploadFolder,

  verifyPDFDimensions,

  extractQRCodeDataFromPDF,

  calculateHash,

  insertCertificateData,

  insertBatchCertificateData,

  holdExecution,

  // Function to check if MongoDB is connected
  isDBConnected,

  // Function to add a link and QR code to a PDF file
  addLinkToPdf,
}