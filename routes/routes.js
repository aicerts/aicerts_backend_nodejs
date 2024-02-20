const express = require('express');
const router = express.Router();
const {ensureAuthenticated} = require("../config/auth")
const multer = require('multer');
const { fileFilter } = require('../model/tasks');

const adminController = require('../controllers/controllers');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads"); // Set the destination where files will be saved
  },
  filename: (req, file, cb) => {
    const Certificate_Number = req.body.Certificate_Number;
    cb(null, file.originalname);
  },
});

const _upload = multer({ storage, fileFilter });

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
 *               hash:
 *                 type: string
 *                 description: Certificate hash to be verified
  *     responses:
 *       200:
 *         description: Successful operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the operation
 *                 response:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       description: Verification message
 *                     details:
 *                       type: object
 *                       description: Certificate details if available
 *                       properties:
 *                         // Define the properties of the certificate details object here
 *       400:
 *         description: Certificate not found or not valid
 *         schema:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               description: Error message
 *             details:
 *               type: string
 *               description: Additional details about the error
 *       500:
 *         description: Internal server error
 *         schema:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               description: Error message
 */

router.post('/verify-with-id', adminController.verifyWithId);

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

/**
 * @swagger
 * /api/approve-issuer:
 *   post:
 *     summary: Approve a user
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
 *                   example: User not found (or) User Approved!
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

router.post('/approve-issuer',ensureAuthenticated, adminController.approveIssuer);

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
module.exports=router;