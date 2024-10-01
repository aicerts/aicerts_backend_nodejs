// Load environment variables from .env file
require('dotenv').config();
const { QRCodeStyling } = require("qr-code-styler-node/lib/qr-code-styling.common.js");
const nodeCanvas = require("canvas");
const fs = require("fs");
const QRCode = require('qrcode');
const sharp = require('sharp');
const { fromBuffer } = require("pdf2pic");
const AWS = require('../config/aws-config');

const bucketName = process.env.BUCKET_NAME;
const acl = process.env.ACL_NAME;

const with_pdf_width = parseInt(process.env.WITH_PDF_WIDTH);
const with_pdf_height = parseInt(process.env.WITH_PDF_HEIGHT);

var logoUrl = "https://certs365-live.s3.amazonaws.com/logo.png";

// Function to load an image and return a promise that resolves when the image is processed
const loadImage = async (url) => {
    const { default: fetch } = await import('node-fetch');
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok.');
        const buffer = await response.arrayBuffer();
        const image = await sharp(buffer).metadata(); // Process the image with sharp (optional)
        return image;
    } catch (error) {
        console.error("Error loading image:", error);
        throw error;
    }
};

const getOption = async (url, qrSide, code) => {
    // console.log("inputs", url, qrSide, code);
    var option;
    await loadImage(logoUrl);
    switch (code) {
        case 1:
            option = {
                width: qrSide,
                height: qrSide,
                data: url,
                image: logoUrl,
                qrOptions: {
                    typeNumber: "0",
                    mode: "Byte",
                    errorCorrectionLevel: "Q",
                },
                dotsOptions: {
                    color: "#000000",
                    type: "extra-rounded"
                },
                backgroundOptions: {
                    color: "#ffffff",
                },
                imageOptions: {
                    crossOrigin: "anonymous",
                    margin: 0
                },
                cornersSquareOptions: {
                    color: "#000000",
                    type: "extra-rounded",
                },
                cornersDotOptions: {
                    type: "",
                    color: "#cfa935",
                }
            };
            break;
        case 2:
            option = {
                width: qrSide,
                height: qrSide,
                data: url,
                image: logoUrl,
                qrOptions: {
                    typeNumber: "0",
                    mode: "Byte",
                    errorCorrectionLevel: "Q",
                },
                dotsOptions: {
                    color: "#000000",
                    type: "dots"
                },
                backgroundOptions: {
                    color: "#ffffff",
                },
                imageOptions: {
                    crossOrigin: "anonymous",
                    margin: 0
                },
                cornersSquareOptions: {
                    color: "#000000",
                    type: "extra-rounded",
                },
                cornersDotOptions: {
                    type: "",
                    color: "#cfa935",
                }
            };
            break;
        case 3:
            option = {
                width: qrSide,
                height: qrSide,
                data: url,
                image: logoUrl,
                qrOptions: {
                    typeNumber: "0",
                    mode: "Byte",
                    errorCorrectionLevel: "Q",
                },
                dotsOptions: {
                    color: "#000000",
                    type: "classy"
                },
                backgroundOptions: {
                    color: "#ffffff",
                },
                imageOptions: {
                    crossOrigin: "anonymous",
                    margin: 0
                },
                cornersSquareOptions: {
                    color: "#000000",
                    type: "extra-rounded",
                },
                cornersDotOptions: {
                    type: "",
                    color: "#cfa935",
                }
            };
            break;
        default:
            option = {
                width: qrSide,
                height: qrSide,
                data: url,
                image: logoUrl,
                qrOptions: {
                    typeNumber: "0",
                    mode: "Byte",
                    errorCorrectionLevel: "Q",
                },
                dotsOptions: {
                    color: "#000000",
                    type: "extra-rounded"
                },
                backgroundOptions: {
                    color: "#ffffff",
                },
                imageOptions: {
                    crossOrigin: "anonymous",
                    margin: 0
                },
                cornersSquareOptions: {
                    color: "#000000",
                    type: "extra-rounded",
                },
                cornersDotOptions: {
                    type: "",
                    color: "#cfa935",
                }
            };
    }
    return option;
};

const convertPdfBufferToPng = async (certNumber, pdfBuffer, _width, _height) => {

    if (!certNumber || !pdfBuffer) {
        console.error('Invalid arguments: certificationNumber and pdfBuffer are required.');
        return false;
    }
    const options = {
        format: 'png', // Specify output format (optional, defaults to 'png')
        responseType: 'buffer', // Ensure binary output (PNG buffer)
        width: _width * 2, // Optional width for the image
        height: _height * 2, // Optional height for the image
        density: 300, // Optional DPI (dots per inch)
        // Other options (refer to pdf2pic documentation for details)
    };

    try {
        const convert = fromBuffer(pdfBuffer, options);
        const pageOutput = await convert(1, { responseType: 'buffer' }); // Convert page 1 (adjust as needed)
        let base64String = await pageOutput.base64;
        // Remove the data URL prefix if present
        // const base64Data = await base64String.replace(/^data:image\/png;base64,/, '');
        // Convert Base64 to buffer
        const _buffer = Buffer.from(base64String, 'base64');

        const _keyName = `${certNumber}.png`;
        const s3 = new AWS.S3();
        const keyPrefix = 'issues/';
        const keyName = keyPrefix + _keyName;

        const uploadParams = {
            Bucket: bucketName,
            Key: keyName,
            Body: _buffer,
            ContentType: 'image/png',
            ACL: acl
        };

        try {
            const urlData = await s3.upload(uploadParams).promise();
            console.log("The initial upload", urlData.Location);
            return urlData.Location;
        } catch (error) {
            console.error("Internal server error", error);
        }

        return false;
    } catch (error) {
        console.error('Error converting PDF to PNG buffer:', error);
        return false;
    }
};

const _convertPdfBufferToPng = async (certNumber, pdfBuffer, _width, _height) => {
    if (!certNumber || !pdfBuffer) {
        console.error('Invalid arguments: certificationNumber and pdfBuffer are required.');
        return false;
    }
    const options = {
        format: 'png', // Specify output format (optional, defaults to 'png')
        responseType: 'buffer', // Ensure binary output (PNG buffer)
        width: _width * 3, // Opti/onal width for the image
        height: _height * 3, // Optional height for the image
        density: 100, // Optional DPI (dots per inch)
        // Other options (refer to pdf2pic documentation for details)
    };

    try {
        const convert = fromBuffer(pdfBuffer, options);
        const pageOutput = await convert(1, { responseType: 'buffer' }); // Convert page 1 (adjust as needed)
        let base64String = await pageOutput.base64;
        // Remove the data URL prefix if present
        // const base64Data = await base64String.replace(/^data:image\/png;base64,/, '');
        // Convert Base64 to buffer
        const _buffer = Buffer.from(base64String, 'base64');

        const _keyName = `${certNumber}.png`;
        const s3 = new AWS.S3();
        const keyPrefix = 'dynamic_bulk_issues/';
        const keyName = keyPrefix + _keyName;

        const uploadParams = {
            Bucket: bucketName,
            Key: keyName,
            Body: _buffer,
            ContentType: 'image/png',
            ACL: acl
        };

        try {
            const urlData = await s3.upload(uploadParams).promise();
            console.log("The initial upload", urlData.Location);
            return urlData.Location;
        } catch (error) {
            console.error("Internal server error", error);
        }

        return true;
    } catch (error) {
        console.error('Error converting PDF to PNG buffer:', error);
        return false;
    }
};

const __uploadgenerateVibrantQr = async (url, qrSide, code) => {
    if (code == 0) {
        return false;
    }
    try {
        const options = await getOption(url, qrSide, code);

        // Adjust options for better sharpness
        options.errorCorrectionLevel = 'H'; // Use high error correction

        // For canvas type
        const qrCodeImage = new QRCodeStyling({
            nodeCanvas, // this is required
            ...options,
        });

        const buffer = await qrCodeImage.getRawData("png", { quality: 1.0 });
        // Convert buffer to Base64
        const base64String = await buffer.toString('base64');
        // Prepend the data URL prefix
        const dataUrl = `data:image/png;base64,${base64String}`;
        // fs.writeFileSync("test.png", buffer);
        // console.log("the buffer data", dataUrl);
        return dataUrl; // Return the buffer
        // return null
    } catch (error) {
        console.error("The error is ", error);
        return null;
    }
};

const generateVibrantQr = async (url, qrSide, code) => {
    if (code == 0) {
        return false;
    }
    try {
        const options = await getOption(url, qrSide, code);

        // Adjust options for better sharpness
        options.errorCorrectionLevel = 'H'; // Use high error correction

        // For canvas type
        const qrCodeImage = new QRCodeStyling({
            nodeCanvas, // this is required
            ...options,
        });

        const buffer = await qrCodeImage.getRawData("png", { quality: 1.0 });

        // Create a canvas and context
        const canvas = nodeCanvas.createCanvas(qrSide, qrSide + 20); // Increase height to accommodate text
        const ctx = canvas.getContext("2d");

        // Load the generated QR code image onto the canvas
        const qrImage = await nodeCanvas.loadImage(buffer);
        ctx.drawImage(qrImage, 0, 0, qrSide, qrSide);

        // Set text properties
        ctx.font = "bold 25px Arial"; // Customize text style
        ctx.fillStyle = "#000000"; // Customize text color
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";

        // Draw text at the bottom left
        const text = "testverify.certs365.io";
        ctx.fillText(text, 0, qrSide + 25); // Adjust position of text

        // Convert canvas to buffer with the text overlay
        const finalBuffer = canvas.toBuffer("image/png");

        // Convert buffer to Base64
        const base64String = await finalBuffer.toString('base64');
        // Prepend the data URL prefix
        const dataUrl = `data:image/png;base64,${base64String}`;
        // fs.writeFileSync("test.png", buffer);
        // console.log("the buffer data", dataUrl);
        return dataUrl; // Return the buffer
        // return null
    } catch (error) {
        console.error("The error is ", error);
        return null;
    }
};

// Function to regenerate the QR code with DB information
const generateQrDetails = async (certificateNumber) => {
    try {
        let qrCodeData = process.env.SHORT_URL + certificateNumber;
        let qrCodeImage = await QRCode.toDataURL(qrCodeData, {
            errorCorrectionLevel: "H",
            width: 450, // Adjust the width as needed
            height: 450, // Adjust the height as needed
        });

        return qrCodeImage;
    } catch (error) {
        console.error("The error occured while generating qr", error);
        return null;
    }
};

module.exports = {
    // Function to convert PDF buffer into image
    convertPdfBufferToPng,

    _convertPdfBufferToPng,

    generateVibrantQr,

    generateQrDetails

};