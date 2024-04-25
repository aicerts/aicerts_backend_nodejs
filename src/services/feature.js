// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const path = require("path");
const QRCode = require("qrcode");
const fs = require("fs");
const { ethers } = require("ethers"); // Ethereum JavaScript library

// Import custom cryptoFunction module for encryption and decryption
const { generateEncryptedUrl } = require("../common/cryptoFunction");

// Import MongoDB models
const { User, Issues, BatchIssues } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Importing functions from a custom module
const {
    convertDateFormat,
    convertDateToEpoch,
    insertIssueStatus,
    convertEpochToDate, // Function to insert certificate data into the database
    getCertificationStatus,
    calculateHash, // Function to calculate the hash of a file
    isDBConnected, // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

// Retrieve contract address from environment variable
const contractAddress = process.env.CONTRACT_ADDRESS;

// Define an array of providers to use as fallbacks
const providers = [
    new ethers.AlchemyProvider(process.env.RPC_NETWORK, process.env.ALCHEMY_API_KEY),
    new ethers.InfuraProvider(process.env.RPC_NETWORK, process.env.INFURA_API_KEY)
    // Add more providers as needed
];

// Create a new FallbackProvider instance
const fallbackProvider = new ethers.FallbackProvider(providers);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const newContract = new ethers.Contract(contractAddress, abi, signer);

// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH);
const max_length = parseInt(process.env.MAX_LENGTH);

var messageCode = require("../common/codes");

const handleRenewCertification = async (email, certificateNumber, _expirationDate) => {
    const expirationDate = await convertDateFormat(_expirationDate);
    // Get today's date
    var today = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }); // Adjust timeZone as per the US Standard Time zone
    // Convert today's date to epoch time (in milliseconds)
    var todayEpoch = new Date(today).getTime() / 1000; // Convert milliseconds to seconds

    var epochExpiration = await convertDateToEpoch(expirationDate);
    var validExpiration = todayEpoch + (32 * 24 * 60 * 60); // Add 32 days (30 * 24 hours * 60 minutes * 60 seconds);

    try {
        await isDBConnected();
        // Check if user with provided email exists
        const idExist = await User.findOne({ email });
        // Check if certificate number already exists
        const isNumberExist = await Issues.findOne({ certificateNumber: certificateNumber });
        // Check if certificate number already exists in the Batch
        const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: certificateNumber });

        // Validation checks for request data
        if (
            (!idExist || idExist.status !== 1) || // User does not exist
            !certificateNumber || // Missing certificate number
            (!expirationDate || expirationDate == 'Invalid date') ||
            (epochExpiration < validExpiration)
        ) {
            // Prepare error message
            let errorMessage = messageCode.msgPlsEnterValid;
            // Check for specific error conditions and update the error message accordingly
            if (!expirationDate || expirationDate == 'Invalid date') {
                errorMessage = messageCode.msgProvideValidDates;
            } else if (!certificateNumber) {
                errorMessage = messageCode.msgCertIdRequired;
            } else if (!idExist) {
                errorMessage = messageCode.msgInvalidIssuer;
            } else if (idExist.status !== 1) {
                errorMessage = messageCode.msgUnauthIssuer;
            }
            else if (epochExpiration < validExpiration) {
                errorMessage = messageCode.msgInvalidExpiration;
            }
            // Respond with error message
            return ({ code: 400, status: "FAILED", message: errorMessage });
        }

        if (isNumberExist) {

            var epochExpiration = await convertDateToEpoch(isNumberExist.expirationDate);
            if (epochExpiration < todayEpoch) {
                return ({ code: 400, status: "FAILED", message: messageCode.msgCertExpired });
            }

            try {

                // Blockchain calls
                const getCertificateStatus = await newContract.getCertificateStatus(certificateNumber);
                var batchStatus = parseInt(getCertificateStatus);
                if (batchStatus == 3) {
                    // Respond with error message
                    return ({ code: 400, status: "FAILED", message: messageCode.msgNotPossibleOnRevoked });
                }

                const certDateValidation = await expirationDateVariaton(isNumberExist.expirationDate, expirationDate);

                if (certDateValidation == 0 || certDateValidation == 2) {
                    // Respond with error message
                    return ({ code: 400, status: "FAILED", message: `${messageCode.msgEpirationMustGreater}: ${isNumberExist.expirationDate}` });
                }

                // Prepare fields for the certificate
                const fields = {
                    Certificate_Number: certificateNumber,
                    name: isNumberExist.name,
                    courseName: isNumberExist.course,
                    Grant_Date: isNumberExist.grantDate,
                    Expiration_Date: expirationDate,
                };
                // Hash sensitive fields
                const hashedFields = {};
                for (const field in fields) {
                    hashedFields[field] = calculateHash(fields[field]);
                }
                const combinedHash = calculateHash(JSON.stringify(hashedFields));

                try {
                    // Verify on blockchain
                    const isPaused = await newContract.paused();
                    const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
                    const verifyOnChain = await newContract.verifyCertificateById(certificateNumber);
                    if (
                        issuerAuthorized === false ||
                        isPaused === true
                    ) {
                        // Issuer not authorized / contract paused
                        if (isPaused === true) {
                            var messageContent = messageCode.msgOpsRestricted;
                        } else if (issuerAuthorized === false) {
                            var messageContent = messageCode.msgIssuerUnauthrized;
                        }
                        return ({ code: 400, status: "FAILED", message: messageContent });
                    }

                    if (verifyOnChain[0] == true) {

                        try {
                            // Perform Expiration extension
                            const tx = await newContract.renewCertificate(
                                certificateNumber,
                                combinedHash,
                                epochExpiration
                            );

                            // await tx.wait();
                            var txHash = tx.hash;

                            // Generate link URL for the certificate on blockchain
                            var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

                        } catch (error) {
                            if (error.reason) {
                                // Extract and handle the error reason
                                console.log("Error reason:", error.reason);
                                return ({ code: 400, status: "FAILED", message: error.reason });
                            } else {
                                // If there's no specific reason provided, handle the error generally
                                console.error(messageCode.msgFailedOpsAtBlockchain, error);
                                return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
                            }
                        }

                        // Generate encrypted URL with certificate data
                        const dataWithLink = { ...fields, polygonLink: polygonLink }
                        const urlLink = generateEncryptedUrl(dataWithLink);

                        // Generate QR code based on the URL
                        const legacyQR = false;
                        let qrCodeData = '';
                        if (legacyQR) {
                            // Include additional data in QR code
                            qrCodeData = `Verify On Blockchain: ${polygonLink},
                Certification Number: ${certificateNumber},
                Name: ${fields.name},
                Certification Name: ${fields.courseName},
                Grant Date: ${fields.Grant_Date},
                Expiration Date: ${expirationDate}`;
                        } else {
                            // Directly include the URL in QR code
                            qrCodeData = urlLink;
                        }

                        var qrCodeImage = await QRCode.toDataURL(qrCodeData, {
                            errorCorrectionLevel: "H",
                            width: 450, // Adjust the width as needed
                            height: 450, // Adjust the height as needed
                        });

                    } else {
                        // Respond with error message
                        return ({ code: 400, status: "FAILED", message: messageCode.msgCertBadRenewStatus });
                    }

                    try {
                        // Check mongoose connection
                        const dbStatus = await isDBConnected();
                        const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
                        console.log(dbStatusMessage);

                        // Save Issue details (modified)
                        isNumberExist.certificateHash = combinedHash;
                        isNumberExist.expirationDate = expirationDate;
                        isNumberExist.transactionHash = txHash;
                        isNumberExist.certificateStatus = 2;
                        isNumberExist.issueDate = Date.now();

                        // Save certification data into database
                        await isNumberExist.save();

                        // Update certificate Count
                        var previousCount = idExist.certificatesIssued;
                        idExist.certificatesIssued = previousCount + 1;
                        await idExist.save(); // Save the changes to the existing user

                        // If user with given id exists, update certificatesRenewed count
                        var previousRenewCount = idExist.certificatesRenewed || 0; // Initialize to 0 if certificatesIssued field doesn't exist
                        idExist.certificatesRenewed = previousRenewCount + 1;
                        await idExist.save(); // Save the changes to the existing user

                        const issuerId = idExist.issuerId;

                        var certificateData = {
                            issuerId,
                            transactionHash: txHash,
                            certificateHash: combinedHash,
                            certificateNumber: certificateNumber,
                            course: isNumberExist.course,
                            name: isNumberExist.name,
                            expirationDate: expirationDate,
                            email: email,
                            certStatus: 2
                        };
                        // Insert certification status data into database
                        await insertIssueStatus(certificateData);

                    } catch (error) {
                        // Handle mongoose connection error (log it, response an error, etc.)
                        console.error(messageCode.msgInternalError, error);
                        return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
                    }

                    // Respond with success message and certificate details
                    return ({
                        code: 200,
                        status: "SUCCESS",
                        message: messageCode.msgCertRenewedSuccess,
                        qrCodeImage: qrCodeImage,
                        polygonLink: polygonLink,
                        details: certificateData,
                    });

                } catch (error) {
                    // Internal server error
                    console.error(error);
                    return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
                }
            } catch (error) {
                // Internal server error
                console.error(error);
                return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
            }

        } else if (isNumberExistInBatch) {

            try {
                //blockchain calls
                var fetchIndex = isNumberExistInBatch.batchId - 1;
                var verifyBatchId = await newContract.verifyBatchRoot(fetchIndex);
                var _fetchRootLength = await newContract.getRootLength();
                var fetchRootLength = parseInt(_fetchRootLength);
                var hashedProof = isNumberExistInBatch.encodedProof;
                var certStatus = await newContract.verifyCertificateInBatch(hashedProof);
                var certificateStatus = await newContract.getBatchCertificateStatus(hashedProof);
                if (verifyBatchId[0] === false || fetchRootLength < fetchIndex) {
                    // Respond with error message
                    return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidRootPassed });
                } else {
                    var batchStatus = isNumberExistInBatch.certificateStatus;
                    if (batchStatus == 3 || (parseInt(certificateStatus) == 3)) {
                        // Respond with error message
                        return ({ code: 400, status: "FAILED", message: messageCode.msgNotPossibleOnRevoked });
                    }

                    const certDateValidation = await expirationDateVariaton(isNumberExistInBatch.expirationDate, expirationDate);

                    if (certDateValidation == 0 || certDateValidation == 2) {
                        // Respond with error message
                        return ({ code: 400, status: "FAILED", message: `${messageCode.msgEpirationMustGreater}: ${isNumberExistInBatch.expirationDate}` });
                    }

                    try {
                        // Verify certificate on blockchain
                        const isPaused = await newContract.paused();
                        const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);

                        if (
                            issuerAuthorized === false ||
                            isPaused === true
                        ) {
                            // Issuer not authorized / contract paused
                            if (isPaused === true) {
                                var messageContent = messageCode.msgOpsRestricted;
                            } else if (issuerAuthorized === false) {
                                var messageContent = messageCode.msgIssuerUnauthrized;
                            }
                            return ({ code: 400, status: "FAILED", message: messageContent });
                        }

                        // Prepare fields for the certificate
                        const fields = {
                            Certificate_Number: certificateNumber,
                            name: isNumberExistInBatch.name,
                            courseName: isNumberExistInBatch.course,
                            Grant_Date: isNumberExistInBatch.grantDate,
                            Expiration_Date: expirationDate,
                        };
                        // Hash sensitive fields
                        const hashedFields = {};
                        for (const field in fields) {
                            hashedFields[field] = calculateHash(fields[field]);
                        }
                        const combinedHash = calculateHash(JSON.stringify(hashedFields));

                        try {
                            // Verify certificate on blockchain
                            const isPaused = await newContract.paused();
                            const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, idExist.issuerId);
                            const verifyOnChain = await newContract.verifyCertificateById(certificateNumber);

                            if (
                                issuerAuthorized === false ||
                                isPaused === true
                            ) {
                                // Issuer not authorized / contract paused
                                if (isPaused === true) {
                                    var messageContent = messageCode.msgOpsRestricted;
                                } else if (issuerAuthorized === false) {
                                    var messageContent = messageCode.msgIssuerUnauthrized;
                                }
                                return ({ code: 400, status: "FAILED", message: messageContent });
                            }

                            if (verifyOnChain[0] === false) {

                                try {
                                    // Perform Expiration extension
                                    const tx = await newContract.renewCertificateInBatch(
                                        fetchIndex,
                                        hashedProof,
                                        epochExpiration
                                    );

                                    // await tx.wait();
                                    var txHash = tx.hash;

                                    // Generate link URL for the certificate on blockchain
                                    var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

                                } catch (error) {
                                    if (error.reason) {
                                        // Extract and handle the error reason
                                        console.log("Error reason:", error.reason);
                                        return ({ code: 400, status: "FAILED", message: error.reason });
                                    } else {
                                        // If there's no specific reason provided, handle the error generally
                                        console.error(messageCode.msgFailedOpsAtBlockchain, error);
                                        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
                                    }
                                }

                                // Generate encrypted URL with certificate data
                                const dataWithLink = { ...fields, polygonLink: polygonLink }
                                const urlLink = generateEncryptedUrl(dataWithLink);

                                // Generate QR code based on the URL
                                const legacyQR = false;
                                let qrCodeData = '';
                                if (legacyQR) {
                                    // Include additional data in QR code
                                    qrCodeData = `Verify On Blockchain: ${polygonLink},
                                        Certification Number: ${certificateNumber},
                                        Name: ${fields.name},
                                        Certification Name: ${fields.courseName},
                                        Grant Date: ${fields.Grant_Date},
                                        Expiration Date: ${expirationDate}`;
                                } else {
                                    // Directly include the URL in QR code
                                    qrCodeData = urlLink;
                                }

                                var qrCodeImage = await QRCode.toDataURL(qrCodeData, {
                                    errorCorrectionLevel: "H",
                                    width: 450, // Adjust the width as needed
                                    height: 450, // Adjust the height as needed
                                });

                            } else {
                                // Respond with error message
                                return ({ code: 400, status: "FAILED", message: messageCode.msgCertBadRenewStatus });
                            }

                            try {
                                // Check mongoose connection
                                const dbStatus = await isDBConnected();
                                const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
                                console.log(dbStatusMessage);

                                // Save Issue details (modified)
                                isNumberExistInBatch.transactionHash = txHash;
                                isNumberExistInBatch.expirationDate = expirationDate;
                                isNumberExistInBatch.certificateStatus = 2;
                                isNumberExistInBatch.issueDate = Date.now();

                                // Save certification data into database
                                await isNumberExistInBatch.save();

                                // Update certificate Count
                                var previousCount = idExist.certificatesIssued;
                                idExist.certificatesIssued = previousCount + 1;
                                await idExist.save(); // Save the changes to the existing user

                                // If user with given id exists, update certificatesRenewed count
                                var previousRenewCount = idExist.certificatesRenewed || 0; // Initialize to 0 if certificatesIssued field doesn't exist
                                idExist.certificatesRenewed = previousRenewCount + 1;
                                await idExist.save(); // Save the changes to the existing user

                                const issuerId = idExist.issuerId;

                                var certificateData = {
                                    issuerId,
                                    batchId: isNumberExistInBatch.batchId,
                                    transactionHash: txHash,
                                    certificateHash: combinedHash,
                                    certificateNumber: certificateNumber,
                                    course: isNumberExistInBatch.course,
                                    name: isNumberExistInBatch.name,
                                    expirationDate: expirationDate,
                                    email: email,
                                    certStatus: 2
                                };
                                // Insert certification status data into database
                                await insertIssueStatus(certificateData);

                            } catch (error) {
                                // Handle mongoose connection error (log it, response an error, etc.)
                                console.error(messageCode.msgInternalError, error);
                                return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
                            }

                            // Respond with success message and certificate details
                            return ({
                                code: 200,
                                status: "SUCCESS",
                                message: messageCode.msgCertRenewedSuccess,
                                qrCodeImage: qrCodeImage,
                                polygonLink: polygonLink,
                                details: isNumberExistInBatch,
                            });

                        } catch (error) {
                            // Internal server error
                            console.error(error);
                            return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
                        }

                    } catch (error) {
                        // Internal server error
                        console.error(error);
                        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
                    }
                }
            } catch (error) {
                // Internal server error
                console.error(error);
                return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
            }

        } else {
            // Respond with error message
            return ({ code: 400, status: "FAILED", message: messageCode.msgCertNotExist });
        }

    } catch (error) {
        // Internal server error
        console.error(error);
        return ({ code: 400, status: "FAILED", message: messageCode.msgInternalError, details: error });
    }
};

const handleUpdateCertificationStatus = async (email, certificateNumber, certStatus) => {
    // Get today's date
    var today = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }); // Adjust timeZone as per the US Standard Time zone
    // Convert today's date to epoch time (in milliseconds)
    var todayEpoch = new Date(today).getTime() / 1000; // Convert milliseconds to seconds

    try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
        console.log(dbStatusMessage);

        const isIssuerExist = await User.findOne({ email }).select('-password');
        // Check if certificate number already exists
        const isNumberExist = await Issues.findOne({ certificateNumber: certificateNumber });
        // Check if certificate number already exists in the Batch
        const isNumberExistInBatch = await BatchIssues.findOne({ certificateNumber: certificateNumber });

        if (!isIssuerExist || (!isNumberExist && !isNumberExistInBatch)) {
            var errorMessage = messageCode.msgPlsEnterValid
            // Invalid Issuer
            if (!isIssuerExist) {
                var errorMessage = messageCode.msgInvalidIssuer;
            } else if (!isNumberExist && !isNumberExistInBatch) {
                var errorMessage = messageCode.msgCertNotExist;
            }
            return ({ code: 400, status: "FAILED", message: errorMessage });
        }
        var _certStatus = await getCertificationStatus(certStatus);

        try {
            // Verify certificate on blockchain
            const isPaused = await newContract.paused();
            const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, isIssuerExist.issuerId);

            if (
                issuerAuthorized === false ||
                isPaused === true
            ) {
                // Issuer not authorized / contract paused
                if (isPaused === true) {
                    var messageContent = messageCode.msgOpsRestricted;
                } else if (issuerAuthorized === false) {
                    var messageContent = messageCode.msgIssuerUnauthrized;
                }
                return ({ code: 400, status: "FAILED", message: messageContent });
            }

            if (isNumberExist) {

                try {
                    var _getCertificateStatus = await newContract.getCertificateStatus(certificateNumber);
                    var getVerifyResponse = await newContract.verifyCertificateById(certificateNumber);
                    var statusResponse = parseInt(getVerifyResponse[2]);

                    var epochExpiration = await convertDateToEpoch(isNumberExist.expirationDate);
                    if ((epochExpiration < todayEpoch) || (getVerifyResponse[0] == true && statusResponse == 5)) {
                        return ({ code: 400, status: "FAILED", message: messageCode.msgCertExpired });
                    }

                    if (isNumberExist.certificateStatus != 3 && certStatus == 4) {
                        return ({ code: 400, status: "FAILED", message: messageCode.msgReactivationNotPossible });
                    }

                    var getCertificateStatus = parseInt(_getCertificateStatus);
                    if (getCertificateStatus == 0) {
                        return ({ code: 400, status: "FAILED", message: messageCode.msgCertNotExist });
                    }
                    if (getCertificateStatus != certStatus) {
                        try {
                            // Perform Expiration extension
                            const tx = await newContract.updateSingleCertificateStatus(
                                certificateNumber,
                                certStatus
                            );

                            // await tx.wait();
                            var txHash = tx.hash;

                            // Generate link URL for the certificate on blockchain
                            var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

                        } catch (error) {
                            if (error.reason) {
                                // Extract and handle the error reason
                                console.log("Error reason:", error.reason);
                                return ({ code: 400, status: "FAILED", message: error.reason });
                            } else {
                                // If there's no specific reason provided, handle the error generally
                                console.error(messageCode.msgFailedOpsAtBlockchain, error);
                                return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
                            }
                        }
                        // Save Issue details (modified)
                        isNumberExist.certificateStatus = certStatus;
                        isNumberExist.transactionHash = txHash;

                        // Save certification data into database
                        await isNumberExist.save();

                        var certificateData = {
                            issuerId: isIssuerExist.issuerId,
                            transactionHash: txHash,
                            certificateNumber: certificateNumber,
                            course: isNumberExist.course,
                            name: isNumberExist.name,
                            expirationDate: isNumberExist.expirationDate,
                            email: email,
                            certStatus: certStatus
                        };

                        // Insert certification status data into database
                        await insertIssueStatus(certificateData);

                        return ({ code: 200, status: "SUCCESS", message: `Updated status: ${_certStatus}`, details: isNumberExist });

                    } else {
                        return ({ code: 400, status: "FAILED", message: messageCode.msgStatusAlreadyExist });
                    }
                } catch (error) {
                    // Internal server error
                    console.error(error);
                    return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
                }

            } else if (isNumberExistInBatch) {

                var epochExpiration = await convertDateToEpoch(isNumberExistInBatch.expirationDate);
                if (epochExpiration < todayEpoch) {
                    return ({ code: 400, status: "FAILED", message: messageCode.msgCertExpired });
                }

                if (isNumberExistInBatch.certificateStatus != 3 && certStatus == 4) {
                    return ({ code: 400, status: "FAILED", message: messageCode.msgReactivationNotPossible });
                }

                try {
                    var fetchIndex = isNumberExistInBatch.batchId - 1;
                    var hashedProof = isNumberExistInBatch.encodedProof;
                    // Blockchain calls
                    var batchStatusResponse = await newContract.verifyBatchRoot(fetchIndex);

                    if (batchStatusResponse[0] === true) {
                        if (isNumberExistInBatch.certificateStatus == parseInt(certStatus)) {
                            return ({ code: 400, status: "FAILED", message: messageCode.msgStatusAlreadyExist });
                        }
                        try {
                            // Perform Expiration extension
                            const tx = await newContract.updateCertificateInBatchStatus(
                                hashedProof,
                                certStatus
                            );

                            // await tx.wait();
                            var txHash = tx.hash;

                            // Generate link URL for the certificate on blockchain
                            var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

                        } catch (error) {
                            if (error.reason) {
                                // Extract and handle the error reason
                                console.log("Error reason:", error.reason);
                                return ({ code: 400, status: "FAILED", message: error.reason });
                            } else {
                                // If there's no specific reason provided, handle the error generally
                                console.error(messageCode.msgFailedOpsAtBlockchain, error);
                                return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
                            }
                        }
                        // Save updated details (modified)
                        isNumberExistInBatch.certificateStatus = certStatus;
                        isNumberExistInBatch.transactionHash = txHash;

                        // Save certification data into database
                        await isNumberExistInBatch.save();

                        var certificateData = {
                            issuerId: isIssuerExist.issuerId,
                            batchId: isNumberExistInBatch.batchId,
                            transactionHash: txHash,
                            certificateNumber: certificateNumber,
                            course: isNumberExistInBatch.course,
                            name: isNumberExistInBatch.name,
                            expirationDate: isNumberExistInBatch.expirationDate,
                            email: email,
                            certStatus: certStatus
                        };

                        // Insert certification status data into database
                        await insertIssueStatus(certificateData);

                        var statusDetails = { batchId: isNumberExistInBatch.batchId, certificateNumber: isNumberExistInBatch.certificateNumber, updatedStatus: _certStatus, polygonLink: polygonLink };
                        return ({ code: 200, status: "SUCCESS", message: messageCode.msgBatchStatusUpdated, details: statusDetails });

                    } else {
                        return ({ code: 400, status: "FAILED", message: messageCode.msgCertNotExist });
                    }
                } catch (error) {
                    // Internal server error
                    console.error(error);
                    return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
                }
            } else {
                return ({ code: 400, status: "FAILED", message: messageCode.msgCertNotExist });
            }

        } catch (error) {
            // Handle any errors that occur during token verification or validation
            return ({ code: 500, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        }
    } catch (error) {
        // Handle any errors that occur during token verification or validation
        return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
    }
};

const handleRenewBatchOfCertifications = async (email, batchId, batchExpirationDate) => {
    const expirationDate = await convertDateFormat(batchExpirationDate);
    // Get today's date
    var today = new Date(); // Adjust timeZone as per the US Standard Time zone
    // Convert today's date to epoch time (in milliseconds)
    var todayEpoch = today.getTime() / 1000; // Convert milliseconds to seconds

    var epochExpiration = await convertDateToEpoch(expirationDate);

    try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
        console.log(dbStatusMessage);

        const isIssuerExist = await User.findOne({ email }).select('-password');
        const rootIndex = parseInt(batchId) - 1;

        if (!isIssuerExist) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuer });
        }
        try {
            // Verify certificate on blockchain
            const isPaused = await newContract.paused();
            const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, isIssuerExist.issuerId);

            if (
                issuerAuthorized === false ||
                isPaused === true
            ) {
                // Issuer not authorized / contract paused
                if (isPaused === true) {
                    var messageContent = messageCode.msgOpsRestricted;
                } else if (issuerAuthorized === false) {
                    var messageContent = messageCode.msgIssuerUnauthrized;
                }
                return ({ code: 400, status: "FAILED", message: messageContent });
            }

            var _rootIndex = parseInt(rootIndex);
            const verifyBatchResponse = await newContract.verifyBatchRoot(_rootIndex);
            const _getIndex = await newContract.getRootLength();
            var getIndex = parseInt(_getIndex);
            if (batchId > getIndex || batchId <= 0) {
                return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidBatch });
            }
            var batchResponse = parseInt(verifyBatchResponse[1]);
            if (verifyBatchResponse[0] === true && batchResponse != 0) {
                var batchEpoch = parseInt(verifyBatchResponse[1]);
                if (batchEpoch < todayEpoch) {
                    return ({ code: 400, status: "FAILED", message: messageCode.msgBatchExpired });
                }

                var batchStatusResponse = parseInt(verifyBatchResponse[2]);
                if(batchStatusResponse == 3){
                    return ({ code: 400, status: "FAILED", message: messageCode.msgNotPossibleOnRevokedBatch });
                }

                var expirationEpochToDate = await convertEpochToDate(batchEpoch);

                const certDateValidation = await expirationDateVariaton(expirationEpochToDate, expirationDate);

                if (certDateValidation == 0 || certDateValidation == 2) {
                    // Respond with error message
                    return ({ code: 400, status: "FAILED", message: `${messageCode.msgEpirationMustGreater}: ${expirationDate}` });
                }

                try {
                    // Perform Expiration extension
                    const tx = await newContract.renewBatchOfCertificates(
                        _rootIndex,
                        epochExpiration
                    );

                    // await tx.wait();
                    var txHash = tx.hash;

                    // Generate link URL for the certificate on blockchain
                    var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

                } catch (error) {
                    if (error.reason) {
                        // Extract and handle the error reason
                        console.log("Error reason:", error.reason);
                        return ({ code: 400, status: "FAILED", message: error.reason });
                    } else {
                        // If there's no specific reason provided, handle the error generally
                        console.error(messageCode.msgFailedOpsAtBlockchain, error);
                        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
                    }
                }
                var statusDetails = { batchId: batchId, updatedExpirationDate: expirationDate, polygonLink: polygonLink };
                return ({ code: 200, status: "SUCCESS", message: messageCode.msgBatchRenewed, details: statusDetails });

            } else if (verifyBatchResponse[0] === true && batchResponse == 0) {
                return ({ code: 400, status: "FAILED", message: messageCode.msgNotPossibleBatch });
            }

        } catch (error) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        }

    } catch (error) {
        return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
    }
};

const handleUpdateBatchCertificationStatus = async (email, batchId, certStatus) => {
        // Get today's date
        var today = new Date(); // Adjust timeZone as per the US Standard Time zone
        // Convert today's date to epoch time (in milliseconds)
        var todayEpoch = today.getTime() / 1000; // Convert milliseconds to seconds
    try {
        // Check mongoose connection
        const dbStatus = await isDBConnected();
        const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
        console.log(dbStatusMessage);

        const isIssuerExist = await User.findOne({ email }).select('-password');
        const rootIndex = parseInt(batchId) - 1;

        if (!isIssuerExist) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidIssuer });
        }
        var _certStatus = await getCertificationStatus(certStatus);
        try {
            // Verify certificate on blockchain
            const isPaused = await newContract.paused();
            const issuerAuthorized = await newContract.hasRole(process.env.ISSUER_ROLE, isIssuerExist.issuerId);

            if (
                issuerAuthorized === false ||
                isPaused === true
            ) {
                // Issuer not authorized / contract paused
                if (isPaused === true) {
                    var messageContent = messageCode.msgOpsRestricted;
                } else if (issuerAuthorized === false) {
                    var messageContent = messageCode.msgIssuerUnauthrized;
                }
                return ({ code: 400, status: "FAILED", message: messageContent });
            }

            var _rootIndex = parseInt(rootIndex);
            const verifyBatchResponse = await newContract.verifyBatchRoot(_rootIndex);
            const getIndex = await newContract.getRootLength();
            if (getIndex <= _rootIndex) {
                return ({ code: 400, status: "FAILED", message: messageCode.msgInvalidBatch });
            }
            var batchResponse = parseInt(verifyBatchResponse[1]);
            if (verifyBatchResponse[0] === true && batchResponse != 0) {
                var batchExpirationEpoch = parseInt(verifyBatchResponse[1]);
                if (batchExpirationEpoch < todayEpoch) {
                    return ({ code: 400, status: "FAILED", message: messageCode.msgBatchExpired });
                }
                try {
                    // Perform Expiration extension
                    const tx = await newContract.updateBatchCertificateStatus(
                        _rootIndex,
                        certStatus
                    );

                    // await tx.wait();
                    var txHash = tx.hash;

                    // Generate link URL for the certificate on blockchain
                    var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

                } catch (error) {
                    if (error.reason) {
                        // Extract and handle the error reason
                        console.log("Error reason:", error.reason);
                        return ({ code: 400, status: "FAILED", message: error.reason });
                    } else {
                        // If there's no specific reason provided, handle the error generally
                        console.error(messageCode.msgFailedOpsAtBlockchain, error);
                        return ({ code: 400, status: "FAILED", message: messageCode.msgFailedOpsAtBlockchain, details: error });
                    }
                }
                var statusDetails = { batchId: batchId, updatedBatchStatus: _certStatus, polygonLink: polygonLink };
                return ({ code: 200, status: "SUCCESS", message: messageCode.msgBatchStatusUpdated, details: statusDetails });

            } else if (verifyBatchResponse[0] === true && batchResponse == 0) {
                return ({ code: 400, status: "FAILED", message: messageCode.msgNotPossibleBatch });
            }

        } catch (error) {
            return ({ code: 400, status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        }

    } catch (error) {
        return ({ code: 500, status: "FAILED", message: messageCode.msgInternalError, details: error });
    }

};

const expirationDateVariaton = async (_oldExpirationDate, _newExpirationDate) => {
    // Split the date strings into parts
    const [month1, day1, year1] = _oldExpirationDate.split('/');
    const [month2, day2, year2] = _newExpirationDate.split('/');

    const oldExpirationDate = new Date(2000 + parseInt(year1), month1 - 1, day1);
    const newExpirationDate = new Date(2000 + parseInt(year2), month2 - 1, day2);

    // console.log("Dates converted", oldExpirationDate, newExpirationDate);

    if (oldExpirationDate < newExpirationDate) {
        console.log("New date is Greater than Old Exipration date");
        return 1;
    } else if (oldExpirationDate > newExpirationDate) {
        console.log("Old date is Greater than New Exipration date");
        return 2;
    } else {
        console.log("Both Dates are Equal");
        return 0;
    }
};

module.exports = {
    // Function to renew a certification
    handleRenewCertification,

    handleUpdateCertificationStatus,

    handleRenewBatchOfCertifications,

    handleUpdateBatchCertificationStatus
};