const { QRCodeStyling } = require("qr-code-styler-node/lib/qr-code-styling.common.js");
const nodeCanvas = require("canvas");
const fs = require("fs");
const sharp = require('sharp');
const { fromBuffer } = require("pdf2pic");

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
    // if(code == 0){
    //     return null;
    // }
    var option;
    // Load the image before creating the options
    await loadImage(logoUrl);
    switch (code) {
        case 1:
            option = {
                width: qrSide,
                height: qrSide,
                data: url,
                image: logoUrl,
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

const convertPdfBufferToPng = async (imagePath, pdfBuffer, _width, _height) => {
    if (!imagePath || !pdfBuffer) {
        console.error('Invalid arguments: imagePath and pdfBuffer are required.');
        return false;
    }
    const options = {
        format: 'png', // Specify output format (optional, defaults to 'png')
        responseType: 'buffer', // Ensure binary output (PNG buffer)
        width: _width * 2, // Optional width for the image
        height: _height * 2, // Optional height for the image
        // width: 2067, // Optional width for the image
        // height: 1477, // Optional height for the image
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

const _convertPdfBufferToPng = async (imagePath, pdfBuffer, _width, _height) => {
    if (!imagePath || !pdfBuffer) {
        console.error('Invalid arguments: imagePath and pdfBuffer are required.');
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

        // Check if base64 data is available
        if (!pageOutput || !pageOutput.base64) {
            // throw new Error('No base64 data returned from conversion.');
            return false;
        }

        let base64String = await pageOutput.base64;
        // Remove the data URL prefix if present
        const base64Data = await base64String.replace(/^data:image\/png;base64,/, '');

        // Convert Base64 to buffer
        const _buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(imagePath, _buffer);

        // Save the PNG buffer to a file
        console.log('Image successfully saved to', imagePath);
        return true;
    } catch (error) {
        console.error('Error converting PDF to PNG buffer:', error);
        return false;
    }
};

const generateVibrantQr = async (url, qrSide, code) => {
    try {

        const options = await getOption(url, qrSide, code);
        // For canvas type

        const qrCodeImage = new QRCodeStyling({
            nodeCanvas, // this is required
            ...options
        });

        const buffer = await qrCodeImage.getRawData("png");
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