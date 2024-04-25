
const { body } = require('express-validator');
const messageCode = require("./codes");

const validationRoutes = {
    issuePdf: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 12, max: 20 }).withMessage(messageCode.msgCertLength),
        body(["name", "course"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 40 }).withMessage(messageCode.msgMaxLength),
        body(["grantDate, expirationDate"]).notEmpty().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    issue: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 12, max: 20 }).withMessage(messageCode.msgCertLength),
        body(["name", "course"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 40 }).withMessage(messageCode.msgMaxLength),
        body(["grantDate, expirationDate"]).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    renewIssue: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 12, max: 20 }).withMessage(messageCode.msgCertLength),
        body(["certStatus"]).not().equals("string").withMessage(messageCode.msgInputProvide)
    ],
    renewBatch: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("batch").notEmpty().trim().isNumeric().withMessage(messageCode.msgInputProvide).custom((value) => {
            const intValue = parseInt(value);
            if (intValue <= 0) {
                throw new Error(messageCode.msgNonZero);
            }
            return true;
        }),
        body("expirationDate").not().equals("string").withMessage(messageCode.msgInputProvide)
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
        body("certificateNumber").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 12, max: 20 }).withMessage(messageCode.msgCertLength),
        body("certStatus").notEmpty().trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn([3, 4]).withMessage(messageCode.msgProvideValidCertStatus),
    ],
    signUp: [
        body(["name"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 30 }).withMessage(messageCode.msgMaxLength),
        body(["password"]).notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    login: [
        body("password").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    emailCheck: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)
    ],
    resetPassword: [
        body("password").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ min: 8, max: 30 }).withMessage(messageCode.msgMaxLength),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail)  
    ],
    checkId: [
        body("id").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength({ max: 20 }).withMessage(messageCode.msgCertLength)
    ],
    validateIssuer: [
        body("status").notEmpty().trim().isNumeric().withMessage(messageCode.msgNonEmpty).isIn([1, 2]).withMessage(messageCode.msgProvideValidStatus),
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail)  
    ],
    checkAddress: [
        body("address").notEmpty().trim().isString().withMessage(messageCode.msgNonEmpty).not().equals("string").withMessage(messageCode.msgInputProvide).isLength(42).withMessage(messageCode.msgInvalidEthereum)
    ],
    queryCode: [
        body("email").notEmpty().trim().isEmail().withMessage(messageCode.msgInvalidEmail).not().equals("string").withMessage(messageCode.msgInvalidEmail),
        body("queryCode").notEmpty().trim().isNumeric().withMessage(messageCode.msgInputProvide).custom((value) => {
            const intValue = parseInt(value);
            if (intValue <= 0) {
                throw new Error(messageCode.msgNonZero);
            }
            return true;
        })
    ]
  };
  
  module.exports = validationRoutes;