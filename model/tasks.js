require('dotenv').config();
const crypto = require('crypto');
const multer = require("multer");
const Web3 = require("web3");
const pdf = require("pdf-lib");
const { PDFDocument, Rectangle } = pdf;
const fs = require("fs");
const path = require("path");
const { fromPath } = require("pdf2pic");
const { PNG } = require("pngjs");
const jsQR = require("jsqr");
const { ethers } = require("ethers");
const mongoose = require("mongoose");

const abi = require("../config/abi.json");
const contractAddress = process.env.CONTRACT_ADDRESS;
const account = process.env.ACCOUNT_ADDRESS;
const _provider = new ethers.providers.getDefaultProvider(process.env.RPC_ENDPOINT);
const adminRouter = new ethers.Contract(contractAddress, abi, _provider); 

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, _provider);
const _contract = new ethers.Contract(contractAddress, abi, wallet);

// mongodb admin model
const { Issues } = require("../config/schema");

const insertCertificateData = async (data) => {
  try {
    
      // Insert data into MongoDB
      const newIssue = new Issues({ 
              id: data.id,
              transactionHash: data.transactionHash,
              certificateHash: data.certificateHash,
              certificateNumber: data.certificateNumber,
              name: data.name,
              course: data.course,
              grantDate: data.grantDate,
              expirationDate: data.expirationDate,
              issueDate: Date.now()
      });
      
      const result = await newIssue.save();
      console.log("Certificate data inserted");
      } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
};

const extractCertificateInfo = (qrCodeText) => {
  // console.log("QR Code Text", qrCodeText);
    const lines = qrCodeText.split("\n");
  const certificateInfo = {
      "Verify On Blockchain": "",
      "Certification Number": "",
      "Name": "",
      "Certification Name": "",
      "Grant Date": "",
      "Expiration Date": ""
    };

    for (const line of lines) {
        const parts = line.trim().split(":");
        if (parts.length === 2) {
            const key = parts[0].trim();
            let value = parts[1].trim();

            value = value.replace(/,/g, "");

            if(key === "Verify On Blockchain") {
                certificateInfo["Verify On Blockchain"] = value;
            } else if (key === "Certification Number") {
                certificateInfo["Certification Number"] = value;
            } else if (key === "Name") {
                certificateInfo["Name"] = value;
            } else if (key === "Certification Name") {
                certificateInfo["Certification Name"] = value;
            } else if (key === "Grant Date") {
                certificateInfo["Grant Date"] = value;
            } else if (key === "Expiration Date") {
                certificateInfo["Expiration Date"] = value;
            }
        }
    }
    return certificateInfo;
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
        /**
         * Initialize PDF to image conversion by supplying a file path
         */
      console.log("PDF file path Test 0", pdfFilePath);
        const base64Response = await fromPath(pdfFilePath, pdf2picOptions)(
            1, // page number to be converted to image
            true // returns base64 output
      );

      console.log("PDF file path - Testting 1",base64Response);
        const dataUri = base64Response?.base64;

      console.log("PDF file path - Testting 2", dataUri);
      if (!dataUri)
          
      console.log("PDF file path - Testting 3", dataUri);
            throw new Error("PDF could not be converted to Base64 string");

        const buffer = Buffer.from(dataUri, "base64");
        const png = PNG.sync.read(buffer);

        const code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
        const qrCodeText = code?.data;

        if (!qrCodeText)
            throw new Error("QR Code Text could not be extracted from PNG image");

        detailsQR = qrCodeText;

        const certificateInfo = extractCertificateInfo(qrCodeText);

        return certificateInfo;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const addLinkToPdf = async (
    inputPath,
    outputPath,
    linkUrl,
    qrCode,
    combinedHash
) => {
    const existingPdfBytes = fs.readFileSync(inputPath);

    const pdfDoc = await pdf.PDFDocument.load(existingPdfBytes);

    const page = pdfDoc.getPage(0);

    const width = page.getWidth();
    const height = page.getHeight();

    page.drawText(linkUrl, {
        x: 62,
        y: 30,
        size: 8,
    });

    // page.drawText(combinedHash, {
    //   x: 5,
    //   y: 10,
    //   size: 3
    // });

    //Adding qr code
    const pdfDc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(qrCode);
    const pngDims = pngImage.scale(0.36);

    page.drawImage(pngImage, {
        x: width - pngDims.width - 117,
        y: 135,
        width: pngDims.width,
        height: pngDims.height,
    });
    qrX = width - pngDims.width - 75;
    qrY = 75;
    qrWidth = pngDims.width;
    qrHeight = pngDims.height;

    pdfBytes = await pdfDoc.save();

    fs.writeFileSync(outputPath, pdfBytes);
    return pdfBytes;
};

const calculateHash = (data)=> {
  return crypto.createHash('sha256').update(data).digest('hex');
};

const web3i = async () => {
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      process.env.RPC_ENDPOINT
    )
  );

  try {
    const validateEndPoint = await web3.eth.net.isListening();
    if(!validateEndPoint){
      return null;
    }

    const contractABI = abi;
    const contract = await new web3.eth.Contract(contractABI, contractAddress);
    return contract;

  } catch (error) {
    console.log("Invalid Endpoint", error);
  }
};

const confirm = async (tx) => {
  const web3 = await new Web3(
    new Web3.providers.HttpProvider(
      process.env.RPC_ENDPOINT
    )
  );

  const gasPrice = await web3.eth.getGasPrice();

  const encodedTx = tx.encodeABI();

  const nonce = await web3.eth.getTransactionCount(account);

  const gasLimit = 1000000;

  const transactionObject = {
    nonce: web3.utils.toHex(nonce),
    from: account,
    to: contractAddress,
    gasLimit: web3.utils.toHex(gasLimit),
    gasPrice: web3.utils.toHex(gasPrice),
    data: encodedTx,
  };

  const signedTransaction = await web3.eth.accounts.signTransaction(
    transactionObject,
    process.env.PRIVATE_KEY
  );

  const ok = await web3.eth.sendSignedTransaction(
    signedTransaction.rawTransaction
  );

  hash = signedTransaction.transactionHash;

  return hash;
};


const simulateIssueCertificate = async (certificateNumber, hash) => {
  // Replace with your actual function name and arguments
  const functionName = 'issueCertificate';
  const functionArguments = [certificateNumber, hash];
  try {
    // const result = await _contract.callStatic.issueCertificate(certificateNumber, hash);
    const result = await _contract.populateTransaction.issueCertificate(certificateNumber, hash);

    // const gasEstimate = await _contract.estimateGas[functionName](...functionArguments);
    // console.log(`Estimated gas required for issueCertificate : `, gasEstimate.toString());
    const resultData = result.data;
    if (resultData.length > 0) {
      return true;
    } else {
      return false;
    }
    } catch (e) {
    if (e.code == ethers.errors.CALL_EXCEPTION) {
      console.log("Simulation failed for issue Certificate.");
      return false;
    }
  }
};

const simulateTrustedOwner = async (contractFunction, address) => {
  // Replace with your actual function name and arguments
  const functionArguments = [address];
  try {
    // const result = await _contract.callStatic.issueCertificate(certificateNumber, hash);
    if (functionName == 'addTrustedOwner') {
      
      var functionName = 'addTrustedOwner';
      var result = await _contract.populateTransaction.addTrustedOwner(address);
    } else {
      var functionName = 'removeTrustedOwner';
      var result = await _contract.populateTransaction.removeTrustedOwner(address);
    }

    // const gasEstimate = await _contract.estimateGas[functionName](...functionArguments);
    // console.log(`Estimated gas required for issueCertificate : `, gasEstimate.toString());
    const resultData = result.data;
    if (resultData.length > 0) {
      return true;
    } else {
      return false;
    }
    } catch (e) {
    if (e.code == ethers.errors.CALL_EXCEPTION) {
      console.log("Simulation failed for issue Certificate.");
      return false;
    }
  }
};


const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only JPEG and PNG files are allowed."),
      false
    );
  }
};

const cleanUploadFolder = async () => {
  const uploadFolder = '/uploads'; // Specify the folder path you want
  const folderPath = path.join(__dirname, '..', uploadFolder);

  // Check if the folder is not empty
  const filesInFolder = fs.readdirSync(folderPath);

  if (filesInFolder.length > 0) {
    // Filter only PDF files
    const pdfFilesInFolder = filesInFolder.filter(file => file.endsWith(".pdf"));
    // Delete all PDF files in the folder
    pdfFilesInFolder.forEach(fileToDelete => {
      const filePathToDelete = path.join(folderPath, fileToDelete);
      try {
        fs.unlinkSync(filePathToDelete);
      } catch (error) {
        console.error("Error deleting file:", filePathToDelete, error);
      }
    });
  }
};

const isDBConncted = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports = { insertCertificateData, extractCertificateInfo, extractQRCodeDataFromPDF, addLinkToPdf, calculateHash, web3i, confirm, fileFilter, simulateTrustedOwner, simulateIssueCertificate, cleanUploadFolder, isDBConncted };