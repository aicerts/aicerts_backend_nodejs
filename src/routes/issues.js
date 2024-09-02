const express = require('express');
const router = express.Router();
const path = require("path");
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const multer = require('multer');
const { fileFilter } = require('../model/tasks'); // Import file filter function
const adminController = require('../controllers/issues');
const validationRoute = require("../common/validationRoutes");

// Configure multer storage options
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./uploads"); // Set the destination where files will be saved
    },
    filename: (req, file, cb) => {
      // Set the filename based on the Certificate_Number from the request body
      cb(null, file.originalname);
    },
  });

  // Initialize multer with configured storage and file filter
  const _upload = multer({ storage, fileFilter });
  
  const __upload = multer({dest: "./uploads/"});

  const upload = multer({ dest: "./uploads/" });

/**
 * @swagger
 * /api/issue:
 *   post:
 *     summary: API call for issuing a certificate (no pdf required)
 *     description: API call for issuing a certificate with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, Response Handling, Blockchain Interaction, Data Encryption, QR Code Generation, Database Interaction, Error Handling and Asynchronous Operation.
 *     tags:
 *       - Issue Certification (Details)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               certificateNumber:
 *                 type: string
 *                 description: The certificate number.
 *               name:
 *                 type: string
 *                 description: The name associated with the certificate.
 *               course:
 *                 type: string
 *                 description: The course name associated with the certificate.
 *               grantDate:
 *                 type: string
 *                 description: The grant date of the certificate.
 *               expirationDate:
 *                 type: string
 *                 description: The expiration date of the certificate.
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - course
 *               - grantDate
 *               - expirationDate
 *     responses:
 *       '200':
 *         description: Successful certificate issuance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 qrCodeImage:
 *                   type: string
 *                 polygonLink:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               message: Certificate issued successfully.
 *               qrCodeImage: Base64-encoded QR code image.
 *               polygonLink: Link to the transaction on the Polygon network.
 *               details: Certificate details.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for certificate already issued or invalid input.
 *       '401':
 *         description: Unauthorized Aceess / No token provided.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (FAILED).
 *                 message:
 *                   type: string
 *                   description: Unauthorized access. No token provided.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal server error.
 *       '503':
 *         description: Service Unavailable temporarily unavailable due to inactive/insufficient credits limit.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: The service is temporarily unavailable due to insufficient credits. Please try again later.
 */

router.post('/issue', validationRoute.issue, ensureAuthenticated, adminController.issue);

/**
 * @swagger
 * /api/issuance:
 *   post:
 *     summary: API call for issuing a LMS certification (Details) Optional Expiration Date.
 *     description: API call for issuing a LMS certificate with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, Response Handling, Blockchain Interaction, Data Encryption, QR Code Generation, Database Interaction, Error Handling and Asynchronous Operation.
 *     tags:
 *       - Issue Certification (Details)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               certificateNumber:
 *                 type: string
 *                 description: The certificate number.
 *               name:
 *                 type: string
 *                 description: The name associated with the certificate.
 *               course:
 *                 type: string
 *                 description: The course name associated with the certificate.
 *               grantDate:
 *                 type: string
 *                 description: The grant date of the certificate.
 *               expirationDate:
 *                 type: string
 *                 description: The expiration date of the certificate (optional), can provide "1" / null / "".
 *               flag:
 *                 type: boolean
 *                 description: The Flag for false:'REGENERATE', true:'REISSUE', default will be 'REGENERATE'.
 *                 default: false
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - course
 *               - grantDate
 *               - expirationDate
 *     responses:
 *       '200':
 *         description: Successful certificate issuance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 qrCodeImage:
 *                   type: string
 *                 polygonLink:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               message: Certificate issued successfully.
 *               qrCodeImage: Base64-encoded QR code image.
 *               polygonLink: Link to the transaction on the Polygon network.
 *               details: Certificate details.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for certificate already issued or invalid input.
 *       '422':
 *         description: User given invalid input (Unprocessable Entity)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for invalid input.
 *       '429':
 *         description: Rate limit exceeded (Too Many Requests)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "FAILED"
 *                 message:
 *                   type: string
 *                   example: "Rate limit exceeded. Please try again later."
 *                 retryAfter:
 *                   type: integer
 *                   example: 60
 *                   description: The number of seconds to wait before making another request.
 *             example:
 *               status: "FAILED"
 *               message: "Rate limit exceeded. Please try again later."
 *               retryAfter: 60
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal server error.
 */

router.post('/issuance', validationRoute.issuance, adminController.Issuance);

/**
 * @swagger
 * /api/issue-pdf:
 *   post:
 *     summary: API call for issuing certificates with a PDF template
 *     description: API call for issuing certificates with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, PDF Generation, Database Interaction, Response Handling, PDF Template, QR Code Integration, File Handling, Asynchronous Operation, Cleanup and Response Format.
 *     tags:
 *       - Issue Certification (*Upload pdf)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               certificateNumber:
 *                 type: string
 *                 description: The certificate number.
 *               name:
 *                 type: string
 *                 description: The name associated with the certificate.
 *               course:
 *                 type: string
 *                 description: The course name associated with the certificate.
 *               grantDate:
 *                 type: string
 *                 description: The grant date of the certificate.
 *               expirationDate:
 *                 type: string
 *                 description: The expiration date of the certificate.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to be uploaded.
 *                 x-parser:
 *                   expression: file.originalname.endsWith('.pdf') // Allow only PDF files
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - course
 *               - grantDate
 *               - file
 *     responses:
 *       '200':
 *         description: Successful certificate issuance in PDF format
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *             example:
 *               status: "SUCCESS"
 *               message: PDF file containing the issued certificate.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for certificate already issued or invalid input.
 *       '401':
 *         description: Unauthorized Aceess / No token provided.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (FAILED).
 *                 message:
 *                   type: string
 *                   description: Unauthorized access. No token provided.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal Server Error.
 *       '503':
 *         description: Service Unavailable temporarily unavailable due to inactive/insufficient credits limit.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: The service is temporarily unavailable due to inactive/insufficient credits. Please try again later.
 */

router.post('/issue-pdf', _upload.single("file"), ensureAuthenticated, adminController.issuePdf);

/**
 * @swagger
 * /api/issue-dynamic-pdf:
 *   post:
 *     summary: API call for issuing certificates with a PDF template with Dynamic QR
 *     description: API call for issuing certificates with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, PDF Generation, Database Interaction, Response Handling, PDF Template, QR Code Integration, File Handling, Asynchronous Operation, Cleanup and Response Format.
 *     tags:
 *       - Issue Certification (*Upload pdf)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               certificateNumber:
 *                 type: string
 *                 description: The certificate number.
 *               name:
 *                 type: string
 *                 description: The name associated with the certificate.
 *               customFields:
 *                 type: object
 *                 description: Custom fields associated with the certificate.
 *               posx:
 *                 type: integer
 *                 description: The horizontal(x-axis) position of the QR in the document.
 *               posy:
 *                 type: integer
 *                 description: The vertical(y-axis) position of the QR in the document.
 *               qrsize:
 *                 type: integer
 *                 description: The side of the QR in the document.
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to be uploaded.
 *                 x-parser:
 *                   expression: file.originalname.endsWith('.pdf') // Allow only PDF files
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - customFields
 *               - posx
 *               - posy
 *               - qrsize
 *               - file
 *     responses:
 *       '200':
 *         description: Successful certificate issuance in PDF format
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *             example:
 *               status: "SUCCESS"
 *               message: PDF file containing the issued certificate.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Error message for certificate already issued or invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal Server Error.
 */

router.post('/issue-dynamic-pdf', _upload.single("file"), ensureAuthenticated, adminController.issueDynamicPdf);

/**
 * @swagger
 * /api/batch-certificate-issue:
 *   post:
 *     summary: API call for issuing batch certificates.
 *     description: API call for issuing batch certificates with Request Data Extraction, Validation Checks, Excel Data Processing, Blockchain Processing, Certificate Issuance, Response Handling, Excel File Processing, Blockchain Verification, Merkle Tree Generation, QR Code Integration, Database Interaction, Error Handling and Asynchronous Operation. 
 *     tags: [Issue Batch (*Upload Excel)]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The issuer email.
 *               excelFile:
 *                 type: string
 *                 format: binary
 *                 description: Excel file to be uploaded. Must not be blank.
 *             required:
 *               - email
 *               - excelFile
 *     responses:
 *       '200':
 *         description: Batch issuance successful
 *         content:
 *           application/json:
 *             example:
 *               status: "SUCCESS"
 *               message: Batch of Certificates issued successfully
 *               polygonLink: https://your-network.com/tx/transactionHash
 *               details:
 *                 - id: 2323a323cb
 *                   batchID: 1
 *                   transactionHash: 12345678
 *                   certuficateHash: 122113523
 *                   certificateNumber: ASD2121
 *                   name: ABC
 *                   course: Advanced AI
 *                   grantDate: 12-12-24
 *                   expirationDate: 12-12-25
 *                   issueDate: 12-12-24
 *                   qrCode: rewrewr34242423
 *                 - id: 2323a323cb
 *                   batchID: 1
 *                   transactionHash: 12345673
 *                   certuficateHash: 122113529
 *                   certificateNumber: ASD3131
 *                   name: XYZ
 *                   course: Advanced AI
 *                   grantDate: 12-11-24
 *                   expirationDate: 12-11-25
 *                   issueDate: 12-11-24
 *                   qrCode: rewrewr34242423
 *                 # Add more certifications details if needed
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error: Bad Request
 *               status: "FAILED"
 *               message: Please provide valid Certification(Batch) details.
 *       '401':
 *         description: Unauthorized Aceess / No token provided.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (FAILED).
 *                 message:
 *                   type: string
 *                   description: Unauthorized access. No token provided.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               status: "FAILED"
 *               error: Internal Server Error
 *       '503':
 *         description: Service Unavailable temporarily unavailable due to inactive/insufficient credits limit.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: The service is temporarily unavailable due to inactive/insufficient credits. Please try again later.
 */

router.post('/batch-certificate-issue', __upload.single("excelFile"), ensureAuthenticated, adminController.batchIssueCertificate);

/**
 * @swagger
 * /api/dynamic-batch-issue:
 *   post:
 *     summary: upload ZIP contain Excel & Pdfs with bulk issue with batch approach with issuer email and download response flag (optional).
 *     description: API extract zip file contents into uploads folder for Dynamic Bulk issue.
 *     tags: [Dynamic Batch Issue]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Issuer email id to be validated
 *               zipFile:
 *                 type: string
 *                 format: binary
 *                 description: ZIP file containing the PDF certificates & Excel to be issued.
 *               flag:
 *                 type: number
 *                 description: Provide flag for download option 0:S3 JSON Response, 1:Zip response.
 *             required:
 *                - email
 *                - zipFile
 *           example:
 *             status: "FAILED"
 *             error: Internal Server Error
 *     responses:
 *       '200':
 *         description: Dynamic Bulk issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 detailsQR:
 *                   type: string
 *             example:
 *               status: "SUCCESS"
 *               message: Dynamic Bulk issued successfully.
 *       '400':
 *         description: Dynamic Bulk not issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Dynamic Bulk not issued successfully.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal Server Error.
 */

router.post('/dynamic-batch-issue', upload.single("zipFile"), ensureAuthenticated, adminController.dynamicBatchIssueCertificates);

/**
 * @swagger
 * /api/provide-inputs:
 *   post:
 *     summary: Provide input parameters for Bulk dynamic issues
 *     description: Provide certificate template dimensions, X-coordinate, y-coordinate, QR Size, Document widht and Document height.
 *     tags: [Dynamic Template]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Issuer email id to be validated
 *               posx:
 *                 type: integer
 *                 description: The horizontal(x-axis) from left position of the QR in the document.
 *               posy:
 *                 type: integer
 *                 description: The vertical(x-axis) from top position of the QR in the document.
 *               qrside:
 *                 type: integer
 *                 description: Certificate QR size
 *               pdfFile:
 *                 type: string
 *                 format: binary
 *                 description: PDF file containing the certificate to be validated.
 *             required:
 *                - email
 *                - posx
 *                - posy
 *                - qrside
 *                - pdfFile
 *     responses:
 *       '200':
 *         description: Successful response
 *         content:
 *           application/json:
 *            schema:
 *              type: object
 *              properties:
 *                status:
 *                  type: string
 *                  example: "SUCCESS"
 *                message:
 *                  type: string
 *                  example: "Valid Inputs"
 *                details:
 *                  type: object
 *                  properties:
 *                    // Define properties of dynamic QR details object here
 *       '400':
 *         description: Invalid input values
 *         content:
 *           application/json:
 *            schema:
 *              type: object
 *              properties:
 *                status:
 *                  type: string
 *                  example: "FAILED"
 *                message:
 *                  type: string
 *                  example: "Invalid input provided"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *            schema:
 *              type: object
 *              properties:
 *                status:
 *                  type: string
 *                  example: "FAILED"
 *                message:
 *                  type: string
 *                  example: "Internal Server error"
 */

router.post('/provide-inputs', _upload.single("pdfFile"), adminController.acceptDynamicInputs);

/**
 * @swagger
 * /api/validate-bulk-issue:
 *   post:
 *     summary: upload ZIP contain Excel & Pdfs to perform validation for dynamic bulk issue approach.
 *     description: API extract zip file contents into uploads folder and validate each document dimension, unique certification ID, QR existance etc.
 *     tags: [Dynamic Template]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Issuer email id to be validate
 *               zipFile:
 *                 type: string
 *                 format: binary
 *                 description: ZIP file containing the PDF certificates & Excel to be validate.
 *             required:
 *                - email
 *                - zipFile
 *           example:
 *             status: "FAILED"
 *             error: Internal Server Error
 *     responses:
 *       '200':
 *         description: Files successfully extracted & validated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 details:
 *                   type: string
 *             example:
 *               status: "SUCCESS"
 *               message: Files successfully validated.
 *       '400':
 *         description: Files successfully not validated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Files successfully Not validated.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Internal Server Error.
 */

router.post('/validate-bulk-issue', upload.single("zipFile"), adminController.validateDynamicBulkIssueDocuments);

module.exports=router;