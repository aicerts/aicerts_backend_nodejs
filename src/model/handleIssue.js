// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path"); // Module for working with file paths

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../utils/cryptoFunction");
// Importing functions from a custom module
const {
    addLinkToPdf, // Function to add a link to a PDF file
    extractQRCodeDataFromPDF,
    calculateHash, // Function to calculate the hash of a file
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

const issuePdfCertificates = async (_pdfReponse, _excelResponse) => {

    const pdfResponse = _pdfReponse;
    const excelResponse = _excelResponse;

    // Extract Certs values from data and append ".pdf"
    const certsWithPDF = excelResponse.map(item => item.Certs + ".pdf");

    // Compare certsWithPDF with data2
    const matchedCerts = pdfResponse.filter(cert => certsWithPDF.includes(cert));

    if (pdfResponse.length == matchedCerts.length) {
        try {
            for (let i = 0; i < pdfResponse.length; i++) {
                const pdfFilePath = path.join(__dirname, '../../uploads', pdfResponse[i]);
                // const getQrStatus = await extractQRCodeDataFromPDF(pdfFilePath);
                var fields = {
                    Certificate_Number: excelResponse[i].certificationID,
                    name: excelResponse[i].name,
                    courseName: excelResponse[i].certificationName,
                    Grant_Date: excelResponse[i].grantDate,
                    Expiration_Date: excelResponse[i].expirationDate,
                };

                var hashedFields = {};
                for (const field in fields) {
                    hashedFields[field] = calculateHash(fields[field]);
                }
                var combinedHash = calculateHash(JSON.stringify(hashedFields));

                console.log("Source Cert", pdfFilePath);

                try {
                    // Blockchain Part

                    // Generate link URL for the certificate on blockchain
                    var linkUrl = `https://${process.env.NETWORK}/tx/${combinedHash}`;

                } catch (error) {
                    console.error("Internal server error", error);
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
                var outputPdf = `${excelResponse[i].Certs}.pdf`;

                // Check if the directory exists, if not, create it
                const destDirectory = path.join(__dirname, '../../uploads/completed');
                if (!fs.existsSync(destDirectory)) {
                    fs.mkdirSync(destDirectory, { recursive: true });
                }
        
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
                
                var outputPath = path.join(__dirname, '../../uploads', 'completed', `${excelResponse[i].Certs}.pdf`);

                
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
            return true;
        } catch (error) {
            console.error("Internal server error", error);
        }

    } else {
        return false;
    }
};

module.exports = {
    // Function to issue a PDF certificates
    issuePdfCertificates,

};