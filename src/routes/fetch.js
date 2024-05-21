const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/fetch');
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const validationRoute = require("../common/validationRoutes");

// const __upload = multer({ storage : _storage });
const __upload = multer({dest: "../../uploads/"});

/**
 * @swagger
 * /api/get-all-issuers:
 *   get:
 *     summary: Get details of all issuers
 *     description: API to fetch all issuer details who are unapproved
 *     tags: [Fetch/Upload]
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
 * /api/get-issuers-log:
 *   post:
 *     summary: Get details of all issuers log with query code
 *     description: API to fetch all issuer details queryCode (1-All Stats {Issued, Renewed, Revoked, Reactivated}, 2-All Details {for revoke}, 3-All Details {for expiration extended} , 4-All Revoked, 5-All expired, 6-Current Details {for revoke}, 7-Current Revoked, 8-Current Details {for expiration extended}).
 *     tags: [Fetch/Upload]
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
 *               queryCode:
 *                 type: number
 *                 description: Provide code to fetch appropriate details
 *     responses:
 *       '200':
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
 *                     [Issuers Log Details]
 *                 message:
 *                   type: string
 *                   example: All issuer log details fetched successfully
 *       '400':
 *         description: Bad request or Invalid code
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
 *                   example: Issuer log details not found (or) Bad request!
 *       '500':
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
 *                   example: An error occurred while fetching issuer log details
 */

router.post('/get-issuers-log', validationRoute.queryCode, adminController.fetchIssuesLogDetails);

/**
 * @swagger
 * /api/get-issue/{input}/{email}:
 *   get:
 *     summary: Fetch Issue data based on the name or Certification ID & user email as input to search
 *     description: Retrieve Issue data based on the provided the name or Certification ID as input & email.
 *     tags: [Fetch/Upload]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: input
 *         description: The input (name or Certification ID) used to fetch Issue details.
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: email
 *         description: The valid user email.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successfully fetched issue data.
 *         content:
 *           application/json:
 *             schema:
 *               type: integer
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Indicates if the request was successful.
 *                 message:
 *                   type: string
 *                   description: A message indicating the result of the operation.
 *                 data:
 *                   type: object
 *                   description: The fetched issue data.
 *             example:
 *               status: "SUCCESS"
 *               message: Issue data fetched successfully.
 *               data: []
 *       '400':
 *         description: Invalid request due to missing or invalid parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Invalid request due to missing or invalid parameters.
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

router.get('/get-issue/:input/:email', adminController.getIssueDetails);

/**
 * @swagger
 * /api/get-graph-data/{year}/{email}:
 *   get:
 *     summary: Fetch graph data based on a year
 *     description: Retrieve graph data based on the provided year-YYYY & email.
 *     tags: [Fetch/Upload]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         description: The value used to fetch graph data. Must be a year-YYYY (number).
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: email
 *         description: The valid user email.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successfully fetched graph data.
 *         content:
 *           application/json:
 *             schema:
 *               type: integer
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Indicates if the request was successful.
 *                 message:
 *                   type: string
 *                   description: A message indicating the result of the operation.
 *                 data:
 *                   type: integer
 *                   description: The fetched graph data.
 *             example:
 *               status: "SUCCESS"
 *               message: Graph data fetched successfully.
 *               data: []
 *       '400':
 *         description: Invalid request due to missing or invalid parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Invalid request due to missing or invalid parameters.
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

router.get('/get-graph-data/:year/:email', adminController.fetchGraphDetails);

/**
 * @swagger
 * /api/get-status-graph-data/{value}/{email}:
 *   get:
 *     summary: Fetch graph data based on a year
 *     description: Retrieve graph data based on the provided value (month-MM or year-YYYY) & email.
 *     tags: [Fetch/Upload]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: value
 *         description: The value used to fetch graph data (month-MM or year-YYYY). Must be a number.
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: email
 *         description: The valid user email.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Successfully fetched graph data.
 *         content:
 *           application/json:
 *             schema:
 *               type: integer
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Indicates if the request was successful.
 *                 message:
 *                   type: string
 *                   description: A message indicating the result of the operation.
 *                 data:
 *                   type: integer
 *                   description: The fetched graph data.
 *             example:
 *               status: "SUCCESS"
 *               message: Graph data fetched successfully.
 *               data: []
 *       '400':
 *         description: Invalid request due to missing or invalid parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Invalid request due to missing or invalid parameters.
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

router.get('/get-status-graph-data/:value/:email', adminController.fetchGraphStatusDetails);

/**
 * @swagger
 * /api/get-issuer-by-email:
 *   post:
 *     summary: Get issuer by email
 *     description: API to Fetch Issuer details on email request.
 *     tags: [Fetch/Upload]
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
 *       '200':
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
 *       '400':
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

router.post('/get-issuer-by-email', validationRoute.emailCheck, adminController.getIssuerByEmail);

/**
 * @swagger
 * /api/get-verification-details:
 *   post:
 *     summary: Get Verification details with course name input
 *     description: API to Fetch Verification details [single, batch, total] on course name request.
 *     tags: [Fetch/Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               course:
 *                 type: string
 *                 description: Course name to search.
 *     responses:
 *       '200':
 *         description: Courses count searched in verification fetched successfully. format [single, batch, total]
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
 *                   description: Response count details of [single, batch, total]
 *                 message:
 *                   type: string
 *                   example: Course search count fetched successfully
 *       '400':
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
router.post('/get-verification-details', validationRoute.courseCheck, adminController.getVerificationDetailsByCourse);

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a file to AWS S3 bucket1
 *     description: API to Upload a file to AWS (Provider) S3 bucket
 *     tags: [Fetch/Upload]
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
 * /api/upload-certificate:
 *   post:
 *     summary: Upload a certificate to AWS S3 bucket
 *     description: API to upload a certificate to AWS (Provider) S3 bucket
 *     tags: [Fetch/Upload]
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
 *               certificateId:
 *                 type: string
 *                 description: The ID of the certificate
 *               type:
 *                 type: number
 *                 description: Type of certificate, 1 for withpdf and 2 for withoutpdf and 3 for batch
 *             required:
 *               - file
 *               - certificateId
 *               - type
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
 *                 fileUrl:
 *                   type: string
 *                   description: URL of the uploaded file
 *       '400':
 *         description: Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the request
 *                 error:
 *                   type: string
 *                   description: Error message
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Status of the request
 *                 error:
 *                   type: string
 *                   description: Error message
 *                 details:
 *                   type: string
 *                   description: Error details
 */

router.post('/upload-certificate',__upload.single('file'),(req, res)=>  adminController.uploadCertificateToS3(req, res));

/**
 * @swagger
 * /api/get-single-certificates:
 *   post:
 *     summary: Get single certificate details
 *     description: API to fetch a single certificate based on issuerId and type (1 for withpdf, 2 for withoutpdf).
 *     tags: [Fetch/Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               issuerId:
 *                 type: string
 *                 description: Issuer's ID
 *               type:
 *                 type: number
 *                 description: Type of certificate (1 for withpdf, 2 for withoutpdf)
 *             required:
 *               - issuerId
 *               - type
 *     responses:
 *       '200':
 *         description: Certificate details fetched successfully
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
 *                     type: object
 *                     properties:
 *                       certificateId:
 *                         type: string
 *                       issuerId:
 *                         type: string
 *                       type:
 *                         type: string
 *                       issueDate:
 *                         type: string
 *                         format: date
 *                       pdfUrl:
 *                         type: string
 *                   example:
 *                     - certificateId: "123456"
 *                       issuerId: "issuer123"
 *                       type: "withpdf"
 *                       issueDate: "2024-01-01"
 *                       pdfUrl: "https://example.com/certificate.pdf"
 *                 message:
 *                   type: string
 *                   example: Certificate fetched successfully
 *       '400':
 *         description: Bad request or invalid input
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
 *                   example: issuerId and type are required
 *       '500':
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
 *                   example: An error occurred while fetching the certificate
 *                 details:
 *                   type: string
 *                   example: Error details
 */

router.post('/get-single-certificates', adminController.getSingleCertificates);

/**
 * @swagger
 * /api/get-batch-certificates:
 *   post:
 *     summary: Get batch certificates based on issuerId
 *     description: API to fetch all batch certificates for a given issuerId. The response will group the certificates by their issueDate.
 *     tags: [Fetch/Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               issuerId:
 *                 type: string
 *                 description: Issuer's ID
 *             required:
 *               - issuerId
 *     responses:
 *       '200':
 *         description: Batch certificates fetched successfully
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
 *                     type: object
 *                     properties:
 *                       issueDate:
 *                         type: string
 *                         format: date
 *                       certificates:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             certificateId:
 *                               type: string
 *                             issuerId:
 *                               type: string
 *                             type:
 *                               type: string
 *                             issueDate:
 *                               type: string
 *                               format: date
 *                             pdfUrl:
 *                               type: string
 *                   example:
 *                     - issueDate: "2024-01-01"
 *                       certificates:
 *                         - certificateId: "123456"
 *                           issuerId: "issuer123"
 *                           type: "withpdf"
 *                           issueDate: "2024-01-01"
 *                           pdfUrl: "https://example.com/certificate.pdf"
 *                 message:
 *                   type: string
 *                   example: Batch certificates fetched successfully
 *       '400':
 *         description: Bad request or invalid input
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
 *                   example: issuerId is required
 *       '500':
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
 *                   example: An error occurred while fetching the batch certificates
 *                 details:
 *                   type: string
 *                   example: Error details
 */

router.post('/get-batch-certificates', adminController.getBatchCertificates);


module.exports=router;