const { parentPort, workerData } = require('worker_threads');
const { holdExecution } = require('../model/tasks');
const { _convertPdfBufferToPng } = require('../utils/generateImage');


const { certNumber, pdfBuffer, pdfWidth, pdfHeight } = workerData;

async function processImage() {
  try {
    const fileBuffer = Buffer.from(pdfBuffer, 'base64');
    const imageUrl = await _convertPdfBufferToPngWithRetry(certNumber, fileBuffer, pdfWidth, pdfHeight);
    parentPort.postMessage({ success: true, imageUrl });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
}

const _convertPdfBufferToPngWithRetry = async (
    certificateNumber,
    pdfBuffer,
    _width,
    _height,
    retryCount = 3
  ) => {
    try {
     
      const imageResponse = await _convertPdfBufferToPng(
        certificateNumber,
        pdfBuffer,
        _width,
        _height
      );
      console.log(imageResponse)
      if (!imageResponse) {
        if (retryCount > 0) {
          console.log(
           ` Image conversion failed. Retrying... Attempts left: ${retryCount}`
          );
          // Retry after a delay (e.g., 2 seconds)
          await holdExecution(2000);
          return _convertPdfBufferToPngWithRetry(
            certificateNumber,
            pdfBuffer,
            _width,
            _height,
            retryCount - 1
          );
        } else {
          // throw new Error('Image conversion failed after multiple attempts');
          return null;
        }
      }
      return imageResponse;
    } catch (error) {
      if (retryCount > 0 && error.code === "ETIMEDOUT") {
        console.log(
          `Connection timed out. Retrying... Attempts left: ${retryCount}`
        );
        // Retry after a delay (e.g., 2 seconds)
        await holdExecution(2000);
        return _convertPdfBufferToPngWithRetry(
          certificateNumber,
          pdfBuffer,
          _width,
          _height,
          retryCount - 1
        );
      } else if (error.code === "NONCE_EXPIRED") {
        // Extract and handle the error reason
        // console.log("Error reason:", error.reason);
        return null;
      } else if (error.reason) {
        // Extract and handle the error reason
        // console.log("Error reason:", error.reason);
        return null;
      } else {
        // If there's no specific reason provided, handle the error generally
        // console.error(messageCode.msgFailedOpsAtBlockchain, error);
        return null;
      }
    }
  };




processImage();