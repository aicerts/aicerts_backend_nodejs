// Load environment variables from .env file
require('dotenv').config();
const readXlsxFile = require('read-excel-file/node');
const path = require("path");

const moment = require('moment');

const thresholdYear = parseInt(process.env.THRESHOLD_YEAR);
// Parse environment variables for password length constraints
const min_length = (parseInt(process.env.MIN_LENGTH) || 12);
const max_length = (parseInt(process.env.MAX_LENGTH) || 20);
const cert_limit = (parseInt(process.env.BATCH_LIMIT) || 150);

// Import MongoDB models
const { Issues, BatchIssues } = require("../config/schema");

// Regular expression to match MM/DD/YY format
const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{2}$/;

// Example usage: Excel Headers
const expectedHeadersSchema = [
    'certificationID',
    'name',
    'certificationName',
    'grantDate',
    'expirationDate'
];

const messageCode = require("../common/codes");

const handleExcelFile = async (_path) => {
    if (!_path) {
        return { status: "FAILED", response: false, message: messageCode.msgInvalidExcel };
    }
    // api to fetch excel data into json
    const newPath = path.join(..._path.split("\\"));
    const sheetNames = await readXlsxFile.readSheetNames(newPath);
    try {
        if (sheetNames == "Batch" || sheetNames.includes("Batch")) {
            // api to fetch excel data into json
            const rows = await readXlsxFile(newPath, { sheet: 'Batch' });
            // Check if the extracted headers match the expected pattern
            const isValidHeaders = JSON.stringify(rows[0]) === JSON.stringify(expectedHeadersSchema);
            if (isValidHeaders) {
                const headers = rows.shift();
                const targetData = rows.map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj; // Return the fetched rows
                });

                // Limit Records to certain limit in the Batch
                if (rows && rows.length > cert_limit && cert_limit != 0) {
                    return { status: "FAILED", response: false, message: messageCode.msgExcelLimit, Details: `Total Records : ${rows.length}` };
                }

                // Batch Certification Formated Details
                var rawBatchData = targetData;

                var certificationIDs = rawBatchData.map(item => item.certificationID);

                var certificationGrantDates = rawBatchData.map(item => item.grantDate);

                var certificationExpirationDates = rawBatchData.map(item => item.expirationDate);

                var holderNames = rawBatchData.map(item => item.name);

                var certificationNames = rawBatchData.map(item => item.certificationName);


                var nonNullGrantDates = certificationGrantDates.filter(date => date == null);
                var nonNullExpiryDates = certificationExpirationDates.filter(date => date == null);
                var notNullCertificationIDs = certificationIDs.filter(item => item == null);
                var notNullHolderNames = holderNames.filter(item => item == null);
                var notNullCertificationNames = certificationNames.filter(item => item == null);

                if (nonNullGrantDates.length != 0 || nonNullExpiryDates.length != 0 || notNullCertificationIDs.length != 0 || notNullHolderNames.length != 0 || notNullCertificationNames.length != 0) {
                    return { status: "FAILED", response: false, message: messageCode.msgMissingDetailsInExcel };
                }

                // Initialize an empty list to store matching IDs
                const matchingIDs = [];
                const repetitiveNumbers = await findRepetitiveIdNumbers(certificationIDs);
                const invalidIdList = await validateBatchCertificateIDs(certificationIDs);

                if (invalidIdList != false) {
                    return { status: "FAILED", response: false, message: messageCode.msgInvalidCertIds, Details: invalidIdList };

                }

                if (repetitiveNumbers.length > 0) {
                    return { status: "FAILED", response: false, message: messageCode.msgExcelRepetetionIds, Details: repetitiveNumbers };

                }

                const invalidGrantDateFormat = await findInvalidDates(certificationGrantDates);
                const invalidExpirationDateFormat = await findInvalidDates(certificationExpirationDates);

                if ((invalidGrantDateFormat.invalidDates).length > 0 || (invalidExpirationDateFormat.invalidDates).length > 0) {
                    return { status: "FAILED", response: false, message: messageCode.msgInvalidDateFormat, Details: `Grant Dates ${invalidGrantDateFormat.invalidDates}, Issued Dates ${invalidExpirationDateFormat.invalidDates}` };

                }

                const validateGrantDates = await compareEpochDates(invalidGrantDateFormat.validDates);
                const validateExpirationDates = await compareEpochDates(invalidExpirationDateFormat.validDates);
                if ((validateGrantDates).length > 0 || (validateExpirationDates).length > 0) {
                    return { status: "FAILED", response: false, message: messageCode.msgInvalidDates, Details: `Grant Dates ${validateGrantDates}, Issued Dates ${validateExpirationDates}` };

                }

                const validateCertificateDates = await compareGrantExpiredSetDates(invalidGrantDateFormat.validDates, invalidExpirationDateFormat.validDates);
                if (validateCertificateDates.length > 0) {
                    return { status: "FAILED", response: false, message: messageCode.msgOlderDateThanNewDate, Details: `${validateCertificateDates}` };

                }

                // Assuming BatchIssues is your MongoDB model
                for (const id of certificationIDs) {
                    const issueExist = await Issues.findOne({ certificateNumber: id });
                    const _issueExist = await BatchIssues.findOne({ certificateNumber: id });
                    if (issueExist || _issueExist) {
                        matchingIDs.push(id);
                    }
                }

                if (matchingIDs.length > 0) {

                    return { status: "FAILED", response: false, message: messageCode.msgExcelHasExistingIds, Details: matchingIDs };

                }
                return { status: "SUCCESS", response: true, message: [targetData, rows.length, rows] };

            } else {
                return { status: "FAILED", response: false, message: messageCode.msgInvalidHeaders };
            }
        } else {
            return { status: "FAILED", response: false, message: messageCode.msgExcelSheetname };
        }

    } catch (error) {
        console.error('Error fetching record:', error);
        return { status: "FAILED", response: false, message: messageCode.msgInternalError };
    }
};

const validateBatchCertificateIDs = async (data) => {
    const invalidStrings = [];

    data.forEach(num => {
        const str = num.toString(); // Convert number to string
        if (str.length < min_length || str.length > max_length) {
            invalidStrings.push(str);
        }
    });

    if (invalidStrings.length > 0) {
        return invalidStrings; // Return array of invalid strings
    } else {
        return false; // Return false if all strings are valid
    }
};

const findRepetitiveIdNumbers = async (data) => {
    const countMap = {};
    const repetitiveNumbers = [];

    // Count occurrences of each number
    data.forEach((number) => {
        countMap[number] = (countMap[number] || 0) + 1;
    });

    // Iterate through the count map to find repetitive numbers
    for (const [key, value] of Object.entries(countMap)) {
        if (value > 1) {
            repetitiveNumbers.push(key);
        }
    }

    return repetitiveNumbers;
};

const findInvalidDates = async (dates) => {
    const validDates = [];
    const invalidDates = [];

    for (let dateString of dates) {
        if (dateString) {
            // Check if the date matches the regex for valid dates with 2-digit years
            if (regex.test(dateString)) {
                validDates.push(dateString);
            } else {
                // Check if the year component has 3 digits, indicating an invalid date
                const year = parseInt(dateString.split('/')[2]);
                if (year >= 98) {
                    invalidDates.push(dateString);
                } else {
                    validDates.push(dateString);
                }
            }
        } else {
            invalidDates.push(0);
        }
    }

    return { validDates, invalidDates };
};

const compareEpochDates = async (datesList) => {
    const invalidDates = [];
    // Get today's date
    const currentDate = new Date();
    // Function to convert date string to Date object using the provided pattern
    const convertToDate = (dateString) => {
        const [month, day, year] = dateString.split('/');
        return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
    };

    // Compare each date in the list with today's date
    for (const date of datesList) {
        const comparisonDate = convertToDate(date);
        if (comparisonDate.getFullYear() < thresholdYear) {
            if (comparisonDate < currentDate) {
                invalidDates.push(moment(comparisonDate).format('MM/DD/YY'));
            }
        } else {
            invalidDates.push(moment(comparisonDate).format('MM/DD/YY'));
        }
    }
    return invalidDates;
};

// Function to compare two grant & expiration of dates
const compareGrantExpiredSetDates = async (grantList, expirationList) => {
    const dateSets = [];
    const length = Math.min(grantList.length, expirationList.length);

    for (let i = 0; i < length; i++) {
        const grantDateParts = grantList[i].split('/');
        const expirationDateParts = expirationList[i].split('/');
        var j = i + 2;

        // Create Date objects for comparison
        const grantDate = new Date(`20${grantDateParts[2]}`, grantDateParts[0] - 1, grantDateParts[1]);
        const expirationDate = new Date(`20${expirationDateParts[2]}`, expirationDateParts[0] - 1, expirationDateParts[1]);

        if (grantDate > expirationDate) {
            dateSets.push(grantList[i] + "-" + expirationList[i] + " at Row No " + j);
        }
    }

    return dateSets;
};


module.exports = { handleExcelFile };