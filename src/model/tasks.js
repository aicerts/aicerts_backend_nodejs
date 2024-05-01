// Load environment variables from .env file
require('dotenv').config();

const crypto = require('node:crypto'); // Module for cryptographic functions
const path = require("path"); // Module for working with file paths
const fs = require("fs"); // File system module
const pdf = require("pdf-lib"); // Library for creating and modifying PDF documents
const { PDFDocument } = pdf;
const { fromPath } = require("pdf2pic"); // Converter from PDF to images
const { PNG } = require("pngjs"); // PNG image manipulation library
const jsQR = require("jsqr"); // JavaScript QR code reader

const cleanUploadFolder = async () => {
    const uploadFolder = '../uploads'; // Specify the folder path you want
    const folderPath = path.join(__dirname, '..', uploadFolder);
    // Check if the folder is not empty
    const filesInFolder = fs.readdirSync(folderPath);
  
    if (filesInFolder.length > 0) {
      // Delete files in the folder
      filesInFolder.forEach(fileToDelete => {
        const filePathToDelete = path.join(folderPath, fileToDelete);
          try {
            fs.unlinkSync(filePathToDelete);
            console.log("Deleted file:", filePathToDelete);
          } catch (error) {
            console.error("Error deleting file:", filePathToDelete, error);
          }
      });

      // const fileToDelete = filesInFolder[0]; // Get the first file in the folder
      //   const filePathToDelete = path.join(folderPath, fileToDelete); // Construct the full path of the file to delete

      //   // Delete the file
      //   fs.unlink(filePathToDelete, (err) => {
      //       if (err) {
      //           console.error(`Error deleting file "${filePathToDelete}":`, err);
      //       } else {
      //           console.log(`Only Files in "${filePathToDelete}" were deleted successfully.`);
      //     }
      // });
    }
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
  
      // page.drawText(combinedHash, {
      //   x: 5,
      //   y: 10,
      //   size: 3
      // });
  
      //Adding qr code
      // const pdfDc = await PDFDocument.create();
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

  // Function to calculate SHA-256 hash of data
  const calculateHash = (data) => {
    // Create a hash object using SHA-256 algorithm
    // Update the hash object with input data and digest the result as hexadecimal string
    return crypto.createHash('sha256').update(data).digest('hex').toString();
  };

module.exports = {
// Function to clean up the upload folder
  cleanUploadFolder,

  extractQRCodeDataFromPDF,

  calculateHash,

  // Function to add a link and QR code to a PDF file
  addLinkToPdf,
}