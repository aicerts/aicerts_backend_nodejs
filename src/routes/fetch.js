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

router.get('/get-all-issuers',ensureAuthenticated, ensureAuthenticated, adminController.getAllIssuers);

/**
 * @swagger
 * /api/get-issuers-log:
 *   post:
 *     summary: Get details of all issuers log with query params
 *     description: API to fetch all issuer details who are unapproved
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
 * /api/upload:
 *   post:
 *     summary: Upload a file to AWS S3 bucket
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

module.exports=router;