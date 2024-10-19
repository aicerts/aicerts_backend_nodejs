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
const { DynamicBatchIssues, IssueStatus } = require("../config/schema");


const Queue = require("bull");

    // Define the Redis connection options
    const redisConfig = {
      redis: {
        port: process.env.REDIS_PORT || 6379,  // Redis port (6380 from your env)
        host: process.env.REDIS_HOST || 'localhost',  // Redis host (127.0.0.1 from your env)
      }
    };
// Create an S3 upload queue
const s3UploadQueue = new Queue("s3-upload-queue", redisConfig);

s3UploadQueue.on('completed', async (job) => {
  try {
    await job.remove();
    console.log(`Removed job ${job.id} from the queue after completion.`);
  } catch (error) {
    console.error(`Error removing job ${job.id}:`, error.message);
  }
});


// Process the queue jobs with concurrency (e.g., 5 jobs in parallel)
s3UploadQueue.process(10, async (job) => {
  console.log(`Processing s3 batch job ${job.id}`);
  
  const { certificates } = job.data; // Expect an array of certificates
  try {
    // Parallel S3 uploads using Promise.all()
    const imageUrls = await Promise.all(certificates.map(async (certificate) => {
      const { certificateNumber, fileBuffer: base64Buffer, pdfWidth, pdfHeight } = certificate;
      
      // Convert back to Buffer
      const fileBuffer = Buffer.from(base64Buffer, 'base64');
      const imageUrl = await _convertPdfBufferToPngWithRetry(
        certificateNumber,
        fileBuffer,
        pdfWidth,
        pdfHeight
      );
      
      if (!imageUrl) {
        throw new Error("S3 upload failed after retries.");
      }
      
      return imageUrl;
    }));

    console.log(`Completed s3 batch job ${job.id}`);
    
    // Return success result with all image URLs
    return {
      status: "success",
      imageUrls,
    };
  } catch (error) {
    console.error("Error in S3 batch upload process:", error.message);
    // throw error;
  }
});

async function processBulkIssueJob(job,globalData) {
  const {
    pdfResponse,
  } = job.data;
  const { pdfWidth,
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
    qrOption,} = globalData

  const certificateDataArray = []; // Array to collect all certificate data
  const insertUrl = []; // For URLS to return
  const batchS3Jobs = []; // Array to hold S3 job promises
  const s3JobPromises = [];

  try {
    const processPdfTasks = pdfResponse.map(async (pdfFileName) => {
      const { s3UploadData, imageUrl } = await processSinglePdf({
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
        email,
        issuerId,
        allocateBatchId,
        txHash,
        bulkIssueStatus,
        flag,
        qrOption,
        certificateDataArray,
      });

      if (s3UploadData) {
        batchS3Jobs.push(s3UploadData)
        console.log("pushed s3 data in batchs3jobs and length of batchs3 jobs iss", batchS3Jobs.length)
      }

      insertUrl.push(imageUrl); // Collect the image URL for returning
    });

     // Wait for all PDFs to be processed
     await Promise.all(processPdfTasks);

    if(batchS3Jobs.length>0 && flag ==0){
      // console.log("inside batch s3 jobs")
     await s3UploadQueue.add({ certificates: batchS3Jobs });
     console.log("added s3upload data to s3 queue")
      // s3JobPromises.push(s3Job.finished()); // Track completion of the remaining batch
      // console.log("s3 promises finished")
    }

   
    // Wait for all S3 uploads to finish
    // await Promise.all(s3JobPromises);
    

    // Insert all certificate data in bulk
    if (certificateDataArray.length > 0) {
      await insertDynamicBatchCertificateDataBulk(certificateDataArray);
      
    }
    console.log(insertUrl)

    return {
      code: 200,
      status: true,
      message: "Batch issued successfully",
      URLS: insertUrl,
    };
  } catch (error) {
    console.error("Error processing bulk issue job:", error);
    return {
      code: 400,
      status: false,
      message: "Failed to process bulk issue job",
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
  qrOption,
  certificateDataArray,
}) {
  try {
    let shortUrlStatus = false;
    var modifiedUrl;
    let imageUrl = "";
    let generatedImage = null;
    let s3UploadData={}
    const treeData = JSON.parse(serializedTree);
    const tree = StandardMerkleTree.load(treeData);
    const pdfFilePath = path.join(__dirname, "../../uploads", pdfFileName);
    console.log("pdf directory path", pdfFilePath);
    // Extract Certs from pdfFileName
    const certs = pdfFileName.split(".")[0]; // Remove file extension
    const foundEntry = excelResponse.find(
      (entry) => entry.documentName === certs
    );
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

    // const encryptLink = await generateEncryptedUrl(fields);

    // if (encryptLink) {
    //   let dbStatus = await isDBConnected();
    //   if (dbStatus) {
    //     let urlData = {
    //       email: email,
    //       certificateNumber: foundEntry.documentID,
    //       url: encryptLink,
    //     };
    //     await insertUrlData(urlData);
    //     shortUrlStatus = true;
    //   }
    // }
    // if (shortUrlStatus) {
      modifiedUrl = process.env.SHORT_URL + foundEntry.documentID;
    // }

    let _qrCodeData = modifiedUrl 
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

    // if (!fs.existsSync(outputPdf)) {
    //   return {
    //     code: 400,
    //     status: "FAILD",
    //     message: messageCode.msgInvalidFilePath,
    //   };
    // }

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
      // imageUrl = await _convertPdfBufferToPngWithRetry(
      //   foundEntry.documentID,
      //   fileBuffer,
      //   pdfWidth,
      //   pdfHeight
      // );
      const base64Buffer = fileBuffer.toString('base64');
      s3UploadData={
        certificateNumber: foundEntry.documentID,
          fileBuffer:base64Buffer,
          pdfWidth,
          pdfHeight,

      }
      imageUrl = `https://certs365-live.s3.amazonaws.com/dynamic_bulk_issues/${foundEntry.documentID}.png`;
      if (!imageUrl) {
        return {
          code: 400,
          status: "FAILED",
          message: messageCode.msgUploadError,
        };
      }
    }

    var certificateData = {
      email:email,
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

    // Push the prepared certificate data into the array for bulk insertion
    certificateDataArray.push(certificateData);

    // Always delete the source files (if it exists)
    // if (fs.existsSync(file)) {
    //   fs.unlinkSync(file);
    // }

    // Always delete the source files (if it exists)
    if (fs.existsSync(outputPdf)) {
      fs.unlinkSync(outputPdf);
    }

    if (bulkIssueStatus == "ZIP_STORE" || flag == 1) {
      fs.writeFileSync(outputPath, fileBuffer);
      console.log("File saved successfully at:", outputPath);
    }

    return {s3UploadData, imageUrl};
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
    console.log(imageResponse)
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

// Function to format a Date object into MM/DD/YYYY
function formatDate(date) {
  if (date instanceof Date) {
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  return date;
}


// Bulk insert function for MongoDB
const insertDynamicBatchCertificateDataBulk = async (dataArray) => {
  try {
    // Map the input data array to the structure required by the DynamicBatchIssues model
    const bulkInsertData = dataArray.map(data => ({
      issuerId: data.issuerId,
      batchId: data.batchId,
      proofHash: data.proofHash,
      encodedProof: data.encodedProof,
      transactionHash: data.transactionHash,
      certificateHash: data.certificateHash,
      certificateNumber: data.certificateNumber,
      name: data.name,
      certificateFields: data.customFields,
      certificateStatus: 1, // Set default status if necessary
      positionX: data.positionX,
      positionY: data.positionY,
      qrSize: data.qrSize,
      width: data.width || without_pdf_width,
      height: data.height || without_pdf_height,
      qrOption: data.qrOption || 0,
      url: data.url || '',
      type: 'dynamic',
      issueDate: Date.now()
    }));

    // Perform bulk insert into DynamicBatchIssues
    const result = await DynamicBatchIssues.insertMany(bulkInsertData, { ordered: false });
    console.log(`Inserted ${result.length} certificate records in bulk.`);

    // Prepare bulk data for IssueStatus
    const bulkStatusData = dataArray.map(data => ({
      email: data.email || null,
      issuerId: data.issuerId, // Required field
      batchId: data.batchId || null,
      transactionHash: data.transactionHash, // Required field
      certificateNumber: data.certificateNumber, // Required field
      course: 0,
      name: data.name,
      expirationDate: 0, // Default, update if necessary
      certStatus: 1, // Set certStatus as needed
      lastUpdate: Date.now()
    }));
  

    // Perform bulk insert into IssueStatus
    await IssueStatus.insertMany(bulkStatusData, { ordered: false });
    console.log(`Inserted ${bulkStatusData.length} issue status records in bulk.`);

  } catch (error) {
    console.error("Error in bulk insert:", error);
  }
};


module.exports = {processBulkIssueJob, s3UploadQueue};

