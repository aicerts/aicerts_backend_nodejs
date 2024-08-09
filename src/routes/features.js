const express = require('express');
const router = express.Router();
const multer = require('multer');
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const adminController = require('../controllers/features');
const validationRoute = require("../common/validationRoutes");

const upload = multer({ dest: "./uploads/" });

/**
 * @swagger
 * /api/renew-cert:
 *   post:
 *     summary: API call for Renew a certificate (no pdf required)
 *     description: API call for issuing a certificate with Request Data Extraction, Validation Checks, Blockchain Processing, Certificate Issuance, Response Handling, Blockchain Interaction, Data Encryption, QR Code Generation, Database Interaction, Error Handling and Asynchronous Operation.
 *     tags:
 *       - Renew Certification (Details)
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
 *               expirationDate:
 *                 type: string
 *                 description: The expiration date of the certificate.
 *             required:
 *               - email
 *               - certificateNumber
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
 *               message: The service is temporarily unavailable due to inactive/insufficient credits. Please try again later.
 */

router.post('/renew-cert', validationRoute.renewIssue, ensureAuthenticated, adminController.renewCert);

/**
 * @swagger
 * /api/update-cert-status:
 *   post:
 *     summary: API call for certificate status update
 *     description: API call for update a certificate status (Revoked, Reactivated ...).
 *     tags:
 *       - Revoke/Reactivate Certification (Details)
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
 *               certStatus:
 *                 type: number
 *                 description: The certificate status.
 *             required:
 *               - email
 *               - certificateNumber
 *               - certStatus
 *     responses:
 *       '200':
 *         description: Successful certificate status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               status: "SUCCESS"
 *               message: Certificate status updated successfully.
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
 *               message: Error message for certificate status update input.
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
 *               message: The service is temporarily unavailable due to inactive/insufficient credits. Please try again later.
 */

router.post('/update-cert-status', validationRoute.updateStatus, ensureAuthenticated, adminController.updateCertStatus);

/**
 * @swagger
 * /api/renew-batch:
 *   post:
 *     summary: API call for Batch Certificates Renewal.
 *     description: API call for update a Batch of certificates expiration date.
 *     tags:
 *       - Renew Certification (Details)
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
 *               batch:
 *                 type: number
 *                 description: The certificate Batch number.
 *               expirationDate:
 *                 type: string
 *                 description: The certificate Batch new Expiration date.
 *             required:
 *               - email
 *               - batch
 *               - expirationDate
 *     responses:
 *       '200':
 *         description: Successful Batch certificates renewed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               status: "SUCCESS"
 *               message: Batch Certificate renewed successfully.
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
 *               message: Error message for batch expiration date update.
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
 *               message: The service is temporarily unavailable due to inactive/insufficient credits. Please try again later.
 */

router.post('/renew-batch', validationRoute.renewBatch, ensureAuthenticated, adminController.renewBatchCertificate);

/**
 * @swagger
 * /api/update-batch-status:
 *   post:
 *     summary: API call for Batch certificate status update
 *     description: API call for update a Batch certificate status (Revoked, Reactivated ...).
 *     tags:
 *       - Revoke/Reactivate Certification (Details)
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
 *               batch:
 *                 type: number
 *                 description: The certificate number.
 *               status:
 *                 type: number
 *                 description: The certificate status.
 *             required:
 *               - email
 *               - certificateNumber
 *               - status
 *     responses:
 *       '200':
 *         description: Successful Batch Certification Status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 details:
 *                   type: object
 *             example:
 *               status: "SUCCESS"
 *               message: Batch Certificate status updated successfully.
 *               details: Batch status update details.
 *       '400':
 *         description: Batch Certification status already issued or invalid input
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
 *               message: Error message for Batch certification status update input.
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
 *               message: The service is temporarily unavailable due to inactive/insufficient credits. Please try again later.
 */

router.post('/update-batch-status', validationRoute.updateBatch, ensureAuthenticated, adminController.updateBatchStatus);

/**
 * @swagger
 * /api/convert-excel:
 *   post:
 *     summary: Input json/csv/xml file containing the data to be converted into excel
 *     description: Provided json/csv/xml file containing the data to be validated and converted into excel.
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
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: json/csv/xml file containing the data to be converted into excel.
 *             required:
 *                - email
 *                - file
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
router.post('/convert-excel', upload.single("file"), adminController.convertIntoExcel);

module.exports=router;