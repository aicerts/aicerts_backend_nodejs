const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const multer = require('multer');
const { fileFilter } = require('../model/tasks'); // Import file filter function
const adminController = require('../controllers/controllers'); // Import admin controller


// Configure multer storage options
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads"); // Set the destination where files will be saved
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
const __upload = multer({dest: "uploads/"});

/**
 * @swagger
 * /api/issue:
 *   post:
 *     summary: Issue certificate
 *     tags:
 *       - Issue Certificate (Details)
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
 *                 qrCodeImage:
 *                   type: string
 *                   description: Base64-encoded QR code image.
 *                 polygonLink:
 *                   type: string
 *                   description: Link to the transaction on the Polygon network.
 *                 details:
 *                   type: object
 *                   description: Certificate details.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for certificate already issued or invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for internal server error.
 */

router.post('/issue',ensureAuthenticated, _upload.single("pdfFile"), adminController.issue);
// router.post('/issue', _upload.single("pdfFile"), adminController.issue);

/**
 * @swagger
 * /api/issue-pdf:
 *   post:
 *     summary: Issue certificate in PDF format
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
 *               description: PDF file containing the issued certificate.
 *       '400':
 *         description: Certificate already issued or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for certificate already issued or invalid input.
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for internal server error.
 */

router.post('/issue-pdf',ensureAuthenticated, _upload.single("file"), adminController.issuePdf);
// router.post('/issue-pdf', _upload.single("file"), adminController.issuePdf);

/**
 * @swagger
 * /api/batch-certificate-issue:
 *   post:
 *     summary: Batch Issue Certificates
 *     description: Endpoint to batch issue certificates and store data on the blockchain
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
 *                 description: Excel file to be uploaded
 *             required:
 *               - email
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
 *                 - issuerId: 2323a323cb
 *                   batchID: 1
 *                   proofHash: [3232a12212]
 *                   transactionHash: 12345678
 *                   certuficateHash: 122113523
 *                   certificateNumber: ASD2121
 *                   name: ABC
 *                   course: Advanced AI
 *                   grantDate: 12-12-24
 *                   expirationDate: 12-12-25
 *                   issueDate: 12-12-24
 *                 - issuerId: 2323a323cb
 *                   batchID: 1
 *                   proofHash: [3232a12213]
 *                   transactionHash: 12345673
 *                   certuficateHash: 122113529
 *                   certificateNumber: ASD3131
 *                   name: XYZ
 *                   course: Advanced AI
 *                   grantDate: 12-11-24
 *                   expirationDate: 12-11-25
 *                   issueDate: 12-11-24
 *                 # Add more certificates details if needed
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error: Bad Request
 *               status: "FAILED"
 *               message: Please provide valid Certificate details / Simulation for the IssueCertificate failed
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
 *     summary: Verify the Certificate with QR - Blockchain URL
 *     tags: [Verifier]
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
 *                   description: Verification result message
 *                 detailsQR:
 *                   type: string
 *                   description: Base64-encoded QR code image.
 *       400:
 *         description: Certificate is not valid or other error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

router.post('/verify', _upload.single("pdfFile"), adminController.verify);

/**
 * @swagger
 * /api/verify-with-id:
 *   post:
 *     summary: Verify a certificate ID on the blockchain
 *     description: Verify the existence and validity of a certificate using its ID on the blockchain.
 *     tags: [Verifier]
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

router.post('/verify-with-id', adminController.verifyWithId);

/**
 * @swagger
 * /api/verify-certification-id:
 *   post:
 *     summary: Verify Single/Batch Certificates by Certification ID
 *     description: Verify single/batch certificates using their certification ID. It checks whether the certification ID exists in the database and validates it against blockchain records if found.
 *     tags: [Single / Batch Verifier]
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
 * /api/approve-issuer:
 *   post:
 *     summary: Approve an Issuer
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
 *                 description: User's email address
 *     responses:
 *       200:
 *         description: User approved successfully
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
 *                   example: User Approved successfully
 *       400:
 *         description: Bad request or user not found
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
 *                   example: User not found!
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
 *                   example: An error occurred during the user approved process!
 */

// router.post('/approve-issuer',ensureAuthenticated, adminController.approveIssuer);
router.post('/approve-issuer', adminController.approveIssuer);

/**
 * @swagger
 * /api/reject-issuer:
 *   post:
 *     summary: Reject an Issuer
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
 *                 description: User's email address
 *     responses:
 *       200:
 *         description: User rejected successfully
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
 *                   example: User Rejected successfully
 *       400:
 *         description: Bad request or user not found
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
 *                   example: User not found!
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
 *                   example: An error occurred during the user rejected process!
 */

// router.post('/reject-issuer',ensureAuthenticated, adminController.rejectIssuer);
router.post('/reject-issuer', adminController.rejectIssuer);

/**
 * @swagger
 * /api/add-trusted-owner:
 *   post:
 *     summary: Add a new trusted owner to the smart contract
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
 *                 description: Ethereum address of the new trusted owner
 *     responses:
 *       200:
 *         description: Trusted owner added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Success
 *                 message:
 *                   type: string
 *                   description: Success message
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
 *         description: An error occurred during the operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for Internal Server Error / Address Available
 */

router.post('/add-trusted-owner',ensureAuthenticated, adminController.addTrustedOwner);

/**
 * @swagger
 * /api/remove-trusted-owner:
 *   post:
 *     summary: Remove a trusted owner from the smart contract
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
 *                 description: Ethereum address of the trusted owner to be removed
 *     responses:
 *       200:
 *         description: Trusted owner removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Success
 *                 message:
 *                   type: string
 *                   description: Success message
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
 *         description: An error occurred during the operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Error message for Internal Server Error / Address Unavailable
 */

router.post('/remove-trusted-owner',ensureAuthenticated, adminController.removeTrustedOwner);

/**
 * @swagger
 * /api/grant-role-to-address:
 *   post:
 *     summary: Grant Admin / Pauser role to an address
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: integer
 *                 description: Role to be assigned (0 for Admin, 1 for Pauser)
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

router.post('/grant-role-to-address',ensureAuthenticated, adminController.grantRoleToAddress);
// router.post('/grant-role-to-address', adminController.grantRoleToAddress);

/**
 * @swagger
 * /api/revoke-role-from-address:
 *   post:
 *     summary: Revoke Admin / Pauser role from the address
 *     tags: [Blockchain]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: integer
 *                 description: Role to be revoked (0 for Admin, 1 for Pauser)
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

router.post('/revoke-role-from-address',ensureAuthenticated, adminController.revokeRoleFromAddress);
// router.post('/revoke-role-from-address', adminController.revokeRoleFromAddress);

/**
 * @swagger
 * /api/check-balance:
 *   get:
 *     summary: Check the balance of an Ethereum account address
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

/**
 * @swagger
 * /api/verify-encrypted:
 *   post:
 *     summary: Verify a certificate with encryption
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

router.post('/verify-encrypted', (req, res) => adminController.decodeCertificate(req, res));

// router.post('/test-function', (req, res) => adminController.testFunction(req, res));

module.exports=router;