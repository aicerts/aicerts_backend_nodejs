

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

  module.exports = {
    verifyDynamicPDFDimensions,
    extractQRCodeDataFromPDF,
    convertDateFormat,
    cleanUploadFolder
  };