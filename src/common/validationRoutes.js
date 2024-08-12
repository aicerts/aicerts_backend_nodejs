
// Load environment variables from .env file
require('dotenv').config();

const { body } = require('express-validator');
const messageCode = require("./codes");

const validationRoutes = {
    issuePdf: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 5, max: 50 }).withMessage(messageCode.msgCertLength),
        body("name").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 50 }).withMessage(messageCode.msgMaxLength),
        body("course").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 150 }).withMessage(messageCode.msgMaxLength),
        body(["grantDate, expirationDate"]).notEmpty().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    issue: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 5, max: 50 }).withMessage(messageCode.msgCertLength),
        body(["name", "course"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 40 }).withMessage(messageCode.msgMaxLength),
        body("grantDate").not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    renewIssue: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 5, max: 50 }).withMessage(messageCode.msgCertLength)
    ],
    organizationIssues: [
        body("organization").notEmpty().trim().isString().not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("name").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    renewBatch: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("batch").notEmpty().trim().isNumeric().withMessage(messageCode.msgInputProvide).custom((value) => {
            const intValue = parseInt(value);
            if (intValue <= 0) {
                throw new Error(messageCode.msgNonZero);
            }
            return true;
        })
    ],
    updateBatch: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("batch").notEmpty().trim().isNumeric().withMessage(messageCode.msgInputProvide).custom((value) => {
            const intValue = parseInt(value);
            if (intValue <= 0) {
                throw new Error(messageCode.msgNonZero);
            }
            return true;
        }),
        body("status").notEmpty().trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn([3, 4]).withMessage(messageCode.msgProvideValidCertStatus),
    ],
    updateStatus: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 5, max: 50 }).withMessage(messageCode.msgCertLength),
        body("certStatus").notEmpty().trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn([3, 4]).withMessage(messageCode.msgProvideValidCertStatus),
    ],
    fetchGraph: [
        body("value").notEmpty().trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn({min: 1, max: 9999}).withMessage(messageCode.msgInvalidGraphInput),
    ],
    courseCheck: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("course").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    signUp: [
        body(["name"]).notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 50 }).withMessage(messageCode.msgMaxLength),
        body(["password"]).notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    login: [
        body("password").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    emailCheck: [
        body("email").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    resetPassword: [
        body("password").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    checkId: [
        body("id").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 1 }).withMessage(messageCode.msgCertLength)
    ],
    checkUrl: [
        body("url").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgInputProvide).isURL().withMessage(messageCode.msgInvalidUrl)
    ],
    validateIssuer: [
        body("status").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn([1, 2]).withMessage(messageCode.msgProvideValidStatus),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail)
    ],
    validateCredits: [
        body("email").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isEmail().withMessage(messageCode.msgInvalidEmail),
        body("status").notEmpty().isBoolean().withMessage(messageCode.msgInvalidStatus),
        body("service").notEmpty().trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn([1, 2, 3, 4]).withMessage(messageCode.msgProvideValidService),
        body("credits")
            .notEmpty().withMessage(messageCode.msgNonEmpty)
            .trim()
            .custom((value) => {
                const intValue = parseInt(value);
                if (intValue < 0) {
                    throw new Error(messageCode.msgValidCredits);
                }
                return true;
            }),
    ],
    searchCertification: [
        body("email").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isEmail().withMessage(messageCode.msgInvalidEmail),
        body("input").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgInputProvide),
        body("type").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isNumeric().isIn([1, 2, 3]).withMessage(messageCode.msgProvideValidType),
    ],
    fetchIssuers: [
        body("key").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgProvideValidFilter),
        body("value").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgProvideValidValue),
    ],
    filterIssues: [
        body("email").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isEmail().withMessage(messageCode.msgInvalidEmail),
        body("filter").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgProvideValidFilter),
        body("input").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().withMessage(messageCode.msgInputProvide),
        body(["page", "limit"]).optional().notEmpty().withMessage(messageCode.msgNonEmpty).trim().isNumeric().withMessage(messageCode.msgInputProvide).custom((value) => {
            const intValue = parseInt(value);
            if (intValue <= 0) {
                throw new Error(messageCode.msgNonZero);
            }
            return true;
        })
    ],
    checkAddress: [
        body("address").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isString().not().equals("string").withMessage(messageCode.msgInputProvide).isLength(42).withMessage(messageCode.msgInvalidEthereum)
    ],
    queryCode: [
        body("email").notEmpty().withMessage(messageCode.msgNonEmpty).trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("queryCode").optional().notEmpty().withMessage(messageCode.msgNonEmpty).trim().isNumeric().withMessage(messageCode.msgInputProvide).custom((value) => {
            const intValue = parseInt(value);
            if (intValue <= 0) {
                throw new Error(messageCode.msgNonZero);
            }
            return true;
        })

    ]
};

module.exports = validationRoutes;