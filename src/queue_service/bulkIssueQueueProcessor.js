const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const messageCode = require("../common/codes");
const {
  isDBConnected,
  insertUrlData,
  addDynamicLinkToPdf,
  insertBulkBatchIssueData,
  deletePngFiles,
  holdExecution,
  insertDynamicBatchCertificateData,
} = require("../model/tasks");
const QRCode = require("qrcode");
const crypto = require("crypto"); // Module for cryptographic functions
const { generateEncryptedUrl } = require("../common/cryptoFunction");
const fs = require("fs");
const path = require("path");
const { fromBuffer, fromBase64 } = require("pdf2pic");
const AWS = require("../config/aws-config");
const {
  generateVibrantQr,
  _convertPdfBufferToPng,
} = require("../utils/generateImage");

async function processBulkIssueJob(job) {
  const {
    pdfResponse,
    pdfWidth,
    pdfHeight,
    linkUrl,
    qrside,
    posx,
    posy,
    excelResponse,
    hashedBatchData,
    serializedTree,
    email,
    issuerId,
    allocateBatchId,
    txHash,
    bulkIssueStatus,
    flag,
    qrOption
  } = job.data;

  const rootDirectory = path.resolve(__dirname, "../../");
  var insertPromises = [];
  const insertUrl = [];

  try {
    const processPdfTasks = pdfResponse.map(
      async (pdfFileName) =>
        await processSinglePdf({
          pdfFileName,
          pdfWidth,
          pdfHeight,
          linkUrl,
          qrside,
          posx,
          posy,
          excelResponse,
          hashedBatchData,
          serializedTree,
          rootDirectory,
          email,
          issuerId,
          allocateBatchId,
          txHash,
          bulkIssueStatus,
          flag,
          insertPromises,
          qrOption
        })
    );

    const results = await Promise.all(processPdfTasks);
    // Check if any of the results indicate failure
    const failedResult = results.find((result) => result.status === "FAILD");

    if (failedResult) {
      // Handle the failure case
      return {
        code: 500,
        status: false,
        message: failedResult.message,
        Details: failedResult.Details,
      };
    }
    insertUrl.push(...results.filter((url) => url !== null));
    await Promise.all(insertPromises);
    return {
      code: 200,
      status: true,
      message: messageCode.msgBatchIssuedSuccess,
      URLS: insertUrl,
    };
  } catch (error) {
    console.error("Error processing bulk issue job:", error);
    return {
      code: 400,
      status: false,
      message: "Failed to process bulk issue  job",
      Details: error.message,
    };
  }
}

async function processSinglePdf({
  pdfFileName,
  pdfWidth,
  pdfHeight,
  linkUrl,
  qrside,
  posx,
  posy,
  excelResponse,
  hashedBatchData,
  serializedTree,
  rootDirectory,
  email,
  issuerId,
  allocateBatchId,
  txHash,
  bulkIssueStatus,
  flag,
  insertPromises,
  qrOption
}) {
  try {
    let shortUrlStatus = false;
    var modifiedUrl;
    let imageUrl = "";
    let generatedImage = null;
    const treeData = JSON.parse(serializedTree);
    const tree = StandardMerkleTree.load(treeData);
    const pdfFilePath = path.join(__dirname, "../../uploads", pdfFileName);
    // console.log("pdf directory path", pdfFilePath);
    // Extract Certs from pdfFileName
    const certs = pdfFileName.split(".")[0]; // Remove file extension
    const foundEntry = excelResponse.find((entry) => entry.documentName === certs);
    if (!foundEntry) {
      console.log("No matching entry found for", certs);
      throw new Error("No matching entry found for certs: " + certs);
    }
    // console.log(`found entry for certs ${certs}`);
    var index = excelResponse.indexOf(foundEntry);
    var _proof = tree.getProof(index);
    let buffers = _proof.map((hex) => Buffer.from(hex.slice(2), "hex"));
    let concatenatedBuffer = Buffer.concat(buffers);
    var _proofHash = crypto
      .createHash("sha256")
      .update(concatenatedBuffer)
      .digest("hex");

    let theObject = await getFormattedFields(foundEntry);
    if (theObject) {
      customFields = JSON.stringify(theObject, null, 2);
    } else {
      customFields = null;
    }

    var fields = {
      Certificate_Number: foundEntry.documentID,
      name: foundEntry.name,
      customFields: customFields,
      polygonLink: linkUrl,
    };

    var combinedHash = hashedBatchData[index];

    const encryptLink = await generateEncryptedUrl(fields);

    if (encryptLink) {
      let dbStatus = await isDBConnected();
      if (dbStatus) {
        let urlData = {
          email: email,
          certificateNumber: foundEntry.documentID,
          url: encryptLink,
        };
        await insertUrlData(urlData);
        shortUrlStatus = true;
      }
    }
    if (shortUrlStatus) {
      modifiedUrl = process.env.SHORT_URL + foundEntry.documentID;
    }

    let _qrCodeData = modifiedUrl != false ? modifiedUrl : encryptLink;
    // Generate vibrant QR
    const generateQr = await generateVibrantQr(_qrCodeData, qrside, qrOption);

    if (!generateQr) {
      var qrCodeImage = await QRCode.toDataURL(_qrCodeData, {
        errorCorrectionLevel: "H",
        width: qrside,
        height: qrside,
      });
    }

    const qrImageData = generateQr ? generateQr : qrCodeImage;
    var file = pdfFilePath;
    var outputPdf = `${pdfFileName}`;

    if (!fs.existsSync(pdfFilePath)) {
      return {
        code: 400,
        status: "FAILD",
        message: messageCode.msgInvalidPdfUploaded,
      };
    }
    // Add link and QR code to the PDF file
    var opdf = await addDynamicLinkToPdf(
      pdfFilePath,
      outputPdf,
      linkUrl,
      qrImageData,
      combinedHash,
      posx,
      posy
    );

    if (!fs.existsSync(outputPdf)) {
      return {
        code: 400,
        status: "FAILD",
        message: messageCode.msgInvalidFilePath,
      };
    }

    // Read the generated PDF file
    var fileBuffer = fs.readFileSync(outputPdf);
    // Assuming fileBuffer is available

    var outputPath = path.join(
      __dirname,
      "../../uploads",
      "completed",
      `${pdfFileName}`
    );

    if (bulkIssueStatus == "ZIP_STORE" || flag == 1) {
      imageUrl = "";
    } else {
      imageUrl = await _convertPdfBufferToPngWithRetry(
        foundEntry.documentID,
        fileBuffer,
        pdfWidth,
        pdfHeight
      );
      if (!imageUrl) {
        return {
          code: 400,
          status: "FAILED",
          message: messageCode.msgUploadError,
        };
      }
    }
    try {
      await isDBConnected();
      var certificateData = {
        issuerId: issuerId,
        batchId: allocateBatchId,
        proofHash: _proof,
        encodedProof: `0x${_proofHash}`,
        transactionHash: txHash,
        certificateHash: combinedHash,
        certificateNumber: fields.Certificate_Number,
        name: fields.name,
        customFields: fields.customFields,
        width: pdfWidth,
        height: pdfHeight,
        qrOption: qrOption,
        url: imageUrl,
      };
      // await insertCertificateData(certificateData);
      insertPromises.push(insertDynamicBatchCertificateData(certificateData));
    } catch (error) {
      console.error("Error:", error);
      return {
        code: 400,
        status: false,
        message: messageCode.msgDBFailed,
        Details: error,
      };
    }
    // Always delete the source files (if it exists)
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }

    // Always delete the source files (if it exists)
    if (fs.existsSync(outputPdf)) {
      fs.unlinkSync(outputPdf);
    }

    if (bulkIssueStatus == "ZIP_STORE" || flag == 1) {
      fs.writeFileSync(outputPath, fileBuffer);
      console.log("File saved successfully at:", outputPath);
    }

    return imageUrl;
  } catch (error) {
    console.error(`Error processing PDF ${pdfFileName}:`, error.message);
    throw error; // Re-throw the error after logging
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
    if (!imageResponse) {
      if (retryCount > 0) {
        console.log(
          `Image conversion failed. Retrying... Attempts left: ${retryCount}`
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

const _uploadImageToS3 = async (certNumber, imagePath) => {
  const bucketName = process.env.BUCKET_NAME;
  const timestamp = Date.now(); // Get the current timestamp in milliseconds
  const _keyName = `${certNumber}.png`;
  const s3 = new AWS.S3();
  // Modify the path to include the -1 suffix
  const fileStream = fs.createReadStream(imagePath.replace(".png", "-1.png"));

  const acl = process.env.ACL_NAME;
  const keyPrefix = "dynamic_bulk_issues/";

  const keyName = keyPrefix + _keyName;

  let uploadParams = {
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ACL: acl,
  };

  try {
    const urlData = await s3.upload(uploadParams).promise();
    return urlData.Location;
  } catch (error) {
    console.error("Internal server error", error);
    return false;
  }
};

// Function to get the last fields after excluding the first three
const getFormattedFields = async (obj) => {
  const keys = Object.keys(obj);

  // Exclude the first three fields
  const fieldsToInclude = keys.slice(3);

  // Create a result object with formatted values, excluding null or empty string values
  const result = {};
  fieldsToInclude.forEach((key) => {
    let value = obj[key];
    if (value instanceof Date) {
      value = formatDate(value);
    } else if (value === null || value === "" || value === "") {
      return; // Skip this entry if value is null or empty string
    } else {
      value = value.toString(); // Convert other values to string
    }
    result[key] = value;
  });

  return result;
};

module.exports = processBulkIssueJob;
