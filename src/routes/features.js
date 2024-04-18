const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require("../config/auth"); // Import authentication middleware
const adminController = require('../controllers/features');
const validationRoute = require("../common/validationRoutes");

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
 */

router.post('/renew-cert', validationRoute.renewIssue, adminController.renewCert);

/**
 * @swagger
 * /api/update-cert-status:
 *   post:
 *     summary: API call for certificate status update
 *     description: API call for update a certificate status (Issued, Revoked ...).
 *     tags:
 *       - Revoke Certification (Details)
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
 *         description: Successful certificate issuance
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
 *               message: Certificate issued successfully.
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
 */

router.post('/update-cert-status', validationRoute.updateStatus, adminController.updateCertStatus);


module.exports=router;