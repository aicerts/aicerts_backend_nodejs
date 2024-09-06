const { QRCodeStyling } = require("qr-code-styler-node/lib/qr-code-styling.common.js");
const nodeCanvas = require("canvas");
const fs = require("fs");
const { fromBuffer } = require("pdf2pic");

const convertPdfBufferToPng = async (imagePath, pdfBuffer) => {
    if (!imagePath || !pdfBuffer) {
        return false;
    }
    const options = {
        format: 'png', // Specify output format (optional, defaults to 'png')
        responseType: 'buffer', // Ensure binary output (PNG buffer)
        width: 2067, // Optional width for the image
        height: 1477, // Optional height for the image
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
        // width: _width, // Optional width for the image
        // height: _height, // Optional height for the image
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

        // await fs.writeFile(imagePath, _buffer, (err) => {
        //     if (err) {
        //         console.error("Error writing PNG file:", err);
        //         return false;
        //     }
        // });
        // Save the PNG buffer to a file
        console.log('Image successfully saved to', imagePath);
        return true;
    } catch (error) {
        console.error('Error converting PDF to PNG buffer:', error);
        return false;
    }
};

const generateVibrantQr = async (url, qrSide) => {
    try {
        const options = {
            width: qrSide,
            height: qrSide,
            data: url,
            image: "https://certs365-live.s3.amazonaws.com/logo.png",
            dotsOptions: {
                color: "#cfa935",
                type: "rounded"
            },
            backgroundOptions: {
                color: "#ffffff",
            },
            imageOptions: {
                crossOrigin: "anonymous",
                margin: 0
            },
            cornersSquareOptions: {
                color: "#cfa935",
                type: "square"
            }
        }
        // For canvas type
        const qrCodeImage = new QRCodeStyling({
            nodeCanvas, // this is required
            ...options
        });

        const buffer = await qrCodeImage.getRawData("png");
        // Convert buffer to Base64
        const base64String = buffer.toString('base64');
        // Prepend the data URL prefix
        const dataUrl = `data:image/png;base64,${base64String}`;
        // fs.writeFileSync("test.png", buffer);
        // console.log("the buffer data", dataUrl);
        return dataUrl; // Return the buffer
    } catch (error) {
        console.error("The error is ", error);
        return null;
    }
};

module.exports = {
    // Function to convert PDF buffer into image
    convertPdfBufferToPng,

    _convertPdfBufferToPng,

    generateVibrantQr

};