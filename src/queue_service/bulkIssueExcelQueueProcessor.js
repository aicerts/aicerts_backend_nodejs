const messageCode = require("../common/codes");
const { DynamicBatchIssues } = require("../config/schema");
// Parse environment variables for password length constraints
const min_length = 6;
const max_length = 40;
// Regular expression to match MM/DD/YY format
const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
const specialCharsRegex = /[!@#$%^&*(),.?":{}|<>]/; // Regular expression for special characters
const cert_limit = parseInt(process.env.DYNAMIC_BATCH_LIMIT);

// const { validateDynamicBatchCertificateIDs, validateDynamicBatchCertificateNames } = require('../services/handleExcel');

const processBulkExcelJobs = async (rawBatchData,rows, jobId) => {
 try {
  var documentIDs = rawBatchData.map(item => item.documentID);
  var holderNames = rawBatchData.map(item => item.name);
  var documentNames = rawBatchData.map(item => item.documentName);

  var notNullDocumentIDs = documentIDs.filter(item => item == null);
  var notNullHolderNames = holderNames.filter(item => item == null);
  var notNullDocumentNames = documentNames.filter(item => item == null);

  if (notNullDocumentIDs.length != 0 || notNullHolderNames.length != 0 || notNullDocumentNames.length != 0) {
      return { status: "FAILED", response: false, message: messageCode.msgMissingDetailsInExcel, Details: "" };
  }

  // Limit Records to certain limit in the Batch
  if (rows && rows.length > cert_limit && cert_limit != 0) {
      return { status: "FAILED", response: false, message: `${messageCode.msgExcelLimit}: ${cert_limit}`, Details: `Input Records : ${rows.length}` };
  }

  // Initialize an empty list to store matching IDs
  const matchingIDs = [];
  const repetitiveNumbers = await findRepetitiveIdNumbers(documentIDs);
  const invalidIdList = await validateDynamicBatchCertificateIDs(documentIDs);
  const invalidNamesList = await validateDynamicBatchCertificateNames(holderNames);
  if (invalidIdList != false) {
      return { status: "FAILED", response: false, message: messageCode.msgInvalidDocIds, Details: invalidIdList };
  }

  if (invalidNamesList != false) {
      return { status: "FAILED", response: false, message: messageCode.msgOnlyAlphabets, Details: invalidNamesList };
  }

  if (repetitiveNumbers.length > 0) {
      return { status: "FAILED", response: false, message: messageCode.msgExcelRepetetionIds, Details: repetitiveNumbers };
  }

  // Assuming BatchIssues is your MongoDB model
  for (const id of documentIDs) {
      const issueExist = await DynamicBatchIssues.findOne({ certificateNumber: id });
      if (issueExist) {
          matchingIDs.push(id);
      }
  }

  if (matchingIDs.length > 0) {

      return { status: "FAILED", response: false, message: messageCode.msgExcelHasExistingIds, Details: matchingIDs };
  }
  console.log("excel validation complete for job:", jobId)

  return {
    status: "SUCCESS",
    response: true
  };
  
 } catch (error) {
  return {
    status: "FAILED",
    response: false,
    Details: error,
  };
  
 }
};

const validateDates = async (dates) => {
  const validDates = [];
  const invalidDates = [];
  for (const date of dates) {
    // Parse the date string to extract month, day, and year
    const [month, day, year] = date.split("/");
    let formattedDate = `${month.padStart(2, "0")}/${day.padStart(
      2,
      "0"
    )}/${year}`;
    const numericMonth = parseInt(month, 10);
    const numericDay = parseInt(day, 10);
    const numericYear = parseInt(year, 10);
    // Check if month, day, and year are within valid ranges
    if (
      numericMonth > 0 &&
      numericMonth <= 12 &&
      numericDay > 0 &&
      numericDay <= 31 &&
      numericYear >= 1900 &&
      numericYear <= 9999
    ) {
      if (
        (numericMonth == 1 ||
          numericMonth == 3 ||
          numericMonth == 5 ||
          numericMonth == 7 ||
          numericMonth == 8 ||
          numericMonth == 10 ||
          numericMonth == 12) &&
        numericDay <= 31
      ) {
        validDates.push(formattedDate);
      } else if (
        (numericMonth == 4 ||
          numericMonth == 6 ||
          numericMonth == 9 ||
          numericMonth == 11) &&
        numericDay <= 30
      ) {
        validDates.push(formattedDate);
      } else if (numericMonth == 2 && numericDay <= 29) {
        if (numericYear % 4 == 0 && numericDay <= 29) {
          // Leap year: February has 29 days
          validDates.push(formattedDate);
        } else if (numericYear % 4 != 0 && numericDay <= 28) {
          // Non-leap year: February has 28 days
          validDates.push(formattedDate);
        } else {
          invalidDates.push(date);
        }
      } else {
        invalidDates.push(date);
      }
    } else {
      invalidDates.push(date);
    }
  }
  return { validDates, invalidDates };
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
      } else if (dateString == 1 || dateString == null) {
        validDates.push(dateString);
      } else {
        // Check if the year component has 3 digits, indicating an invalid date
        const year = parseInt(dateString.split("/")[4]);
        if (year >= process.env.THRESHOLD_YEAR) {
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
const compareGrantExpiredSetDates = async (grantList, expirationList) => {
    const dateSets = [];
    const length = Math.min(grantList.length, expirationList.length);
  
    for (let i = 0; i < length; i++) {
      if (expirationList[i] != 1 && expirationList[i] != null) {
        const grantDateParts = grantList[i].split("/");
        const expirationDateParts = expirationList[i].split("/");
        var j = i + 2;
  
        // Create Date objects for comparison
        const grantDate = new Date(
          `20${grantDateParts[2]}`,
          grantDateParts[0] - 1,
          grantDateParts[1]
        );
        const expirationDate = new Date(
          `20${expirationDateParts[2]}`,
          expirationDateParts[0] - 1,
          expirationDateParts[1]
        );
  
        if (grantDate > expirationDate) {
          dateSets.push(
            grantList[i] + "-" + expirationList[i] + " at Row No " + j
          );
        }
      }
    }
    return dateSets;
  };

  const validateDynamicBatchCertificateIDs = async (data) => {
    const invalidStrings = [];
  
    data.forEach((num) => {
      const str = num.toString(); // Convert number to string
      if (
        str.length < min_length ||
        str.length > 50 ||
        specialCharsRegex.test(str)
      ) {
        invalidStrings.push(str);
      }
    });
  
    if (invalidStrings.length > 0) {
      return invalidStrings; // Return array of invalid strings
    } else {
      return false; // Return false if all strings are valid
    }
  };
  
  const validateDynamicBatchCertificateNames = async (names) => {
    const invalidNames = [];
    names.forEach((name) => {
      const str = name.toString(); // Convert number to string
      if (
        str.length < min_length ||
        str.length > max_length ||
        specialCharsRegex.test(str)
      ) {
        invalidNames.push(str);
      }
    });
  
    if (invalidNames.length > 0) {
      return invalidNames; // Return array of invalid strings
    } else {
      return false; // Return false if all strings are valid
    }
  };

module.exports = processBulkExcelJobs;
