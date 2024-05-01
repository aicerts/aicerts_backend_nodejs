const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controller/extract');

const __upload = multer({dest: "./uploads/"});

/**
 * @swagger
 * /api/extract:
 *   post:
 *     summary: upload ZIP 
 *     description: API extract zip file contents into uploads folder
 *     tags: [Extractor]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               zipFile:
 *                 type: string
 *                 format: binary
 *                 description: ZIP file containing the PDF certificates & Excel to be issued.
 *             required:
 *                - zipFile
 *           example:
 *             status: "FAILED"
 *             error: Internal Server Error
 *     responses:
 *       '200':
 *         description: Files successfully extracted
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
 *               message: Files successfully extracted.
 *       '400':
 *         description: Files successfully not extracted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               status: "FAILED"
 *               message: Files successfully Not extracted.
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
 *               message: Internal Server Error.
 */
router.post('/extract', __upload.single("zipFile"), userController.extract);

module.exports=router;