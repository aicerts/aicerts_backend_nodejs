const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const multer = require('multer');
const { fileFilter } = require('../model/tasks'); // Import file filter function
const adminController = require('../controllers/controllers'); // Import admin controller


// Configure multer storage options
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Set the destination where files will be saved
  },
  filename: (req, file, cb) => {
    // Set the filename based on the Certificate_Number from the request body
    const Certificate_Number = req.body.Certificate_Number;
    cb(null, file.originalname);
  },
});

// Initialize multer with configured storage and file filter
const _upload = multer({ storage, fileFilter });

// const __upload = multer({ storage, excelFilter });
const __upload = multer({dest: "../../uploads/"});

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

router.post('/issue',ensureAuthenticated, adminController.issue);
// router.post('/issue', adminController.issue);

/**
 * @swagger
 * /api/issue-pdf:
 *   post:
 *     summary: API call for issuing certificates with a PDF template
 *     description: API call for issuing certificates with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, PDF Generation, Database Interaction, Response Handling, PDF Template, QR Code Integration, File Handling, Asynchronous Operation, Cleanup and Response Format.
 *     tags:
 *       - Issue Certificate (*Upload pdf)
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
 *             required:
 *               - email
 *               - certificateNumber
 *               - name
 *               - course
 *               - grantDate
 *               - expirationDate
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

router.post('/issue-pdf',ensureAuthenticated, _upload.single("file"), adminController.issuePdf);
// router.post('/issue-pdf', _upload.single("file"), adminController.issuePdf);

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
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               status: "FAILED"
 *               error: Internal Server Error
 */

router.post('/batch-certificate-issue', ensureAuthenticated, __upload.single("excelFile"), adminController.batchCertificateIssue);
// router.post('/batch-certificate-issue', __upload.single("excelFile"), adminController.batchCertificateIssue);

// /**
//  * @swagger
//  * /api/polygonlink:
//  *   get:
//  *     summary: Get Polygon link URL
//  *     description: API route handler is designed to respond to incoming HTTP.  
//  *     tags: [Polygon]
//  *     responses:
//  *       200:
//  *         description: Successful response with Polygon link URL
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 linkUrl:
//  *                   type: string
//  *                   example: "https://example.com/polygon"
//  */

router.get('/polygonlink', adminController.polygonLink);

/**
 * @swagger
 * /api/verify:
 *   post:
 *     summary: Verify the Certification with QR  - Blockchain URL
 *     description: API Verify the Certification with QR in PDF document format - Blockchain URL. 
 *     tags: [Verifier]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdfFile:
 *                 type: string
 *                 format: binary
 *                 description: PDF file containing the certificate to be verified.
 *             required:
 *                - pdfFile
 *           example:
 *             status: "FAILED"
 *             error: Internal Server Error
 *     responses:
 *       200:
 *         description: Certificate verified successfully
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
 *               message: Verification result message.
 *               detailsQR: Base64-decoded QR code image Details.
 *       400:
 *         description: Certificate is not valid or other error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Certificate is not valid or other error.
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

router.post('/verify', _upload.single("pdfFile"), adminController.verify);

/**
 * @swagger
 * /api/verify-with-id:
 *   post:
 *     summary: Verify a certification ID on the blockchain
 *     description: Verify the existence and validity of a certificate using its ID on the blockchain.
 *     tags: [Verifier]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Certification id to be verified
 *     responses:
 *       200:
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
 *                  example: "Valid Certificate"
 *                details:
 *                  type: object
 *                  properties:
 *                    // Define properties of certification details object here
 *       400:
 *         description: Certification not found
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
 *                  example: "Certification doesn't exist"
 *       500:
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

router.post('/verify-with-id', adminController.verifyWithId);

/**
 * @swagger
 * /api/verify-certification-id:
 *   post:
 *     summary: Verify Single/Batch Certificates by Certification ID
 *     description: Verify single/batch certificates using their certification ID. It checks whether the certification ID exists in the database and validates it against blockchain records if found.
 *     tags: [Single / Batch Verifier]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Certificate id to be verified
 *     responses:
 *       200:
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
 *                  example: "Valid Certificate"
 *                details:
 *                  type: object
 *                  properties:
 *                    // Define properties of certificate details object here
 *       400:
 *         description: Certificate not found
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
 *                  example: "Certificate doesn't exist"
 *       500:
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

router.post('/verify-certification-id', adminController.verifyCertificationId);

/**
 * @swagger
 * /api/verify-batch-certificate:
 *   post:
 *     summary: Verify Certificate ID in Batch Certificates
 *     description: Endpoint to verify if a ID exists in the Batch Certificate
 *     tags: [Batch Certificate Verifier]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID to be verified in the Batch Certificate
 *                 example: "1234567efgh"
 *     responses:
 *       '200':
 *         description: ID is verified in the Batch Certificate
 *         content:
 *           application/json:
 *             example:
 *               status: "SUCCESS"
 *               Message: "Verified"
 *       '400':
 *         description: Hash verification failed
 *         content:
 *           application/json:
 *             example:
 *               status: "FAILED"
 *               Message: "Invalid Certificate ID"
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             example:
 *               status: "FAILED"
 *               error: "Internal Server Error."
 */
router.post('/verify-batch-certificate', adminController.verifyBatchCertificate);

/**
 * @swagger
 * /api/signup:
 *   post:
 *     summary: Create a new admin account
 *     description: API to Create a new admin account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Admin's name
 *               email:
 *                 type: string
 *                 description: Admin's email address
 *               password:
 *                 type: string
 *                 description: Admin's password
 *     responses:
 *       200:
 *         description: Signup successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 message:
 *                   type: string
 *                   example: Signup successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *                     id:
 *                       type: string
 *                       example: 123456789
 *                     approved:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Bad request or empty input fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Empty input fields! or Invalid name entered or Invalid email entered or Password is too short!
 *       409:
 *         description: Admin with the provided email already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Admin with the provided email already exists
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: An error occurred
 */

router.post('/signup', adminController.signup);

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Authenticate user login
 *     description: API to Login Admin
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the user.
 *               password:
 *                 type: string
 *                 description: The password for user authentication.
 *             required:
 *               - email
 *               - password
 *     responses:
 *       '200':
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (SUCCESS).
 *                 message:
 *                   type: string
 *                   description: Result message (Valid User Credentials).
 *       '400':
 *         description: Invalid input or empty credentials
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
 *                   description: Result message (Empty credentials supplied).
 *       '401':
 *         description: Invalid credentials entered
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
 *                   description: Result message (Invalid credentials entered).
 *       '500':
 *         description: An error occurred during login
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
 *                   description: Result message (An error occurred during login).
 */


router.post('/login', adminController.login);

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Logout admin
 *     description: API to Logout Admin
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email address of the admin.
 *             required:
 *               - email
 *     responses:
 *       '200':
 *         description: Successful logout
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (SUCCESS).
 *                 message:
 *                   type: string
 *                   description: Result message (Admin Logged out successfully).
 *       '400':
 *         description: Invalid input or admin not found
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
 *                   description: Result message (Admin not found or Not Logged in).
 *       '500':
 *         description: An error occurred during logout
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
 *                   description: Result message (An error occurred during logout).
 */

router.post('/logout',ensureAuthenticated, adminController.logout);

/**
 * @swagger
 * /api/reset-password:
 *   post:
 *     summary: Reset admin password
 *     description: API to reset Admin password
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Admin's email address
 *               password:
 *                 type: string
 *                 description: New password for the admin
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 message:
 *                   type: string
 *                   example: Password reset successful
 *       400:
 *         description: Bad request or admin not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Admin not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: An error occurred during the password reset process!
 */

router.post('/reset-password', adminController.resetPassword);

/**
 * @swagger
 * /api/get-all-issuers:
 *   get:
 *     summary: Get details of all issuers
 *     description: API to fetch all issuer details who are unapproved
 *     tags: [Issuers]
 *     responses:
 *       200:
 *         description: All user details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: array
 *                   items:
 *                     [Issuers Details]
 *                 message:
 *                   type: string
 *                   example: All user details fetched successfully
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: An error occurred while fetching user details
 */

router.get('/get-all-issuers',ensureAuthenticated, adminController.getAllIssuers);
// router.get('/get-all-issuers', adminController.getAllIssuers);

/**
 * @swagger
 * /api/validate-issuer:
 *   post:
 *     summary: Approve or Reject an Issuer
 *     description: API to approve or reject Issuer status (to perform the Issuing Certification over the Blockchain)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: integer
 *                 description: Status code indicating approval (1) or rejection (2)
 *               email:
 *                 type: string
 *                 description: Email of the issuer to be approved or rejected
 *             example:
 *               status: 1
 *               email: issuer@example.com
 *     responses:
 *       '200':
 *         description: Successful operation. Returns status of the email and a success message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation (SUCCESS).
 *                 email:
 *                   type: string
 *                   description: Status of the email (sent or NA).
 *                 message:
 *                   type: string
 *                   description: Success message indicating approval or rejection.
 *       '400':
 *         description: Invalid input parameter or issuer status. Returns a failure message.
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
 *                   description: Error message detailing the issue.
 *       '500':
 *         description: Internal server error. Returns a failure message.
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
 *                   description: Error message indicating an error during the validation process.
 */

router.post('/validate-issuer',ensureAuthenticated, adminController.validateIssuer);
// router.post('/validate-issuer', adminController.validateIssuer);


/**
 * @swagger
 * /api/get-issuer-by-email:
 *   post:
 *     summary: Get issuer by email
 *     description: API to Fetch Issuer details on email request.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Issuer's email address
 *     responses:
 *       200:
 *         description: Issuer fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 data:
 *                   type: object
 *                   description: Issuer details
 *                 message:
 *                   type: string
 *                   example: Issuer fetched successfully
 *       400:
 *         description: Bad request or issuer not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Issuer not found (or) Bad request!
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: An error occurred during the process!
 */

router.post('/get-issuer-by-email', adminController.getIssuerByEmail);

/**
 * @swagger
 * /api/add-trusted-owner:
 *   post:
 *     summary: Grant Admin / Issuer role to an address
 *     description: Add the ISSUER_ROLE to the given Ethereum Address (If it hasn't)
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 format: ethereum-address
 *                 description: Ethereum address to which the role will be assigned
 *     responses:
 *       200:
 *         description: Role successfully granted to the address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the operation result
 *                 details:
 *                   type: string
 *                   description: URL to view transaction details on the blockchain explorer
 *       400:
 *         description: Bad request or invalid role assigned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Reason for the failure
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the internal server error
 */

router.post('/add-trusted-owner',ensureAuthenticated, adminController.addTrustedOwner);
// router.post('/add-trusted-owner', adminController.addTrustedOwner);

/**
 * @swagger
 * /api/remove-trusted-owner:
 *   post:
 *     summary: Revoke Admin / Issuer role from the address
 *     descriotion: Revoke the ISSUER_ROLE from the given Ethereum Address (If it has)
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 format: ethereum-address
 *                 description: Ethereum address to which the role will be revoked
 *     responses:
 *       200:
 *         description: Role successfully revoked from the address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the operation result
 *                 details:
 *                   type: string
 *                   description: URL to view transaction details on the blockchain explorer
 *       400:
 *         description: Bad request or invalid role assigned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Reason for the failure
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 message:
 *                   type: string
 *                   description: Details of the internal server error
 */

router.post('/remove-trusted-owner',ensureAuthenticated, adminController.removeTrustedOwner);
// router.post('/remove-trusted-owner', adminController.removeTrustedOwner);

/**
 * @swagger
 * /api/check-balance:
 *   get:
 *     summary: Check the balance of an Ethereum account address
 *     description: Check MATIC Balance of the given valid Ethereum address
 *     tags: [Blockchain]
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         description: Ethereum account address
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful balance check
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Balance check result message
 *                 balance:
 *                   type: string
 *                   description: Balance in Ether
 *       400:
 *         description: Invalid input or address format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for invalid input
 *       500:
 *         description: An error occurred during the balance check
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for internal server error
 */

router.get('/check-balance',ensureAuthenticated, adminController.checkBalance);
// router.get('/check-balance', adminController.checkBalance);

/**
 * @swagger
 * /api/verify-decrypt:
 *   post:
 *     summary: Verify a certification with encryption
 *     description: API for decode the certiication with encrypted inputs.
 *     tags: [Verifier]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               encryptedData:
 *                 type: string
 *                 description: Encrypted data containing certificate information
 *               iv:
 *                 type: string
 *                 description: Initialization vector used for encryption
 *     responses:
 *       '200':
 *         description: Certificate decoded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Verification status (PASSED)
 *                 message:
 *                   type: string
 *                   description: Verification result message
 *                 data:
 *                   type: object
 *                   properties:
 *               
 *                     Certificate Number:
 *                       type: string
 *                       description: Certificate number
 *                     Course Name:
 *                       type: string
 *                       description: Name of the course
 *                     Expiration Date:
 *                       type: string
 *                       description: Date of certificate expiration
 *                     Grant Date:
 *                       type: string
 *                       description: Date of certificate grant
 *                     Name:
 *                       type: string
 *                       description: Recipient's name
 *                     Polygon Link:
 *                       type: string
 *                       description: Polygon Link
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/verify-decrypt', (req, res) => adminController.decodeCertificate(req, res));

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a file to AWS S3 bucket
 *     description: API to Upload a file to AWS (Provider) S3 bucket
 *     tags: [File]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *             required:
 *                -file
 *     responses:
 *       '200':
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Confirmation message
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */

router.post('/upload',__upload.single('file'),(req, res)=>  adminController.uploadFileToS3(req, res));

/**
 * @swagger
 * /api/health-check:
 *   get:
 *     summary: API to do Health Check
 *     description: API to do Perform checks on the API, such as database connectivity and response times
 *     tags: [Health]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: SUCCESS
 *                 message:
 *                   type: string
 *                   example: API is healthy
 *       500:
 *         description: Health check failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: FAILED
 *                 message:
 *                   type: string
 *                   example: Health check failed
 */

router.get('/health-check', adminController.healthCheck);

module.exports=router;
