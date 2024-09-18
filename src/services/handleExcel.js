// Load environment variables from .env file
require("dotenv").config();
const readXlsxFile = require("read-excel-file/node");
const path = require("path");

// Importing functions from a custom module
const {
  isCertificationIdExisted,
  isBulkCertificationIdExisted,
} = require("../model/tasks"); // Importing functions from the '../model/tasks' module

// Import MongoDB models
const { Issues, DynamicBatchIssues } = require("../config/schema");

// import bull queue
const Queue = require("bull");
// Define the Redis connection options

// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH) || 12;
const max_length = parseInt(process.env.MAX_LENGTH) || 25;
const cert_limit = parseInt(process.env.BATCH_LIMIT);
const sheetName = process.env.SHEET_NAME || "Batch";

// Regular expression to match MM/DD/YY format
const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;

const specialCharsRegex = /[!@#$%^&*(),.?":{}|<>]/; // Regular expression for special characters

// Example usage: Excel Headers
const expectedHeadersSchema = [
  "certificationID",
  "name",
  "certificationName",
  "grantDate",
  "expirationDate",
];

const expectedBulkHeadersSchema = [
  "Certs",
  "certificationID",
  "name",
  "certificationName",
  "grantDate",
  "expirationDate",
];

const messageCode = require("../common/codes");
const {
  getChunkSizeAndConcurrency,
  addJobsInChunks,
  cleanUpJobs,
  processExcelJob,
} = require("../queue_service/queueUtils");

const handleExcelFile = async (_path) => {
  if (!_path) {
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgInvalidExcel,
    };
  }
  // api to fetch excel data into json
  const newPath = path.join(..._path.split("\\"));
  const sheetNames = await readXlsxFile.readSheetNames(newPath);
  if (sheetNames[0] != sheetName || sheetNames.length != 1) {
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgInvalidExcel,
      Details: sheetNames,
    };
  }
  try {
    if (sheetNames == "Batch" || sheetNames.includes("Batch")) {
      // api to fetch excel data into json
      const rows = await readXlsxFile(newPath, { sheet: "Batch" });
      // Check if the extracted headers match the expected pattern
      const isValidHeaders =
        JSON.stringify(rows[0]) === JSON.stringify(expectedHeadersSchema);
      if (isValidHeaders) {
        const headers = rows.shift();
        const targetData = rows.map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj; // Return the fetched rows
        });

        // Limit Records to certain limit in the Batch
        if (rows && rows.length > cert_limit && cert_limit != 0) {
          return {
            status: "FAILED",
            response: false,
            message: `${messageCode.msgExcelLimit}: ${cert_limit}`,
            Details: `Input Records : ${rows.length}`,
          };
        }

        // Batch Certification Formated Details
        var rawBatchData = targetData;

        var certificationIDs = rawBatchData.map((item) => item.certificationID);

        var certificationGrantDates = rawBatchData.map(
          (item) => item.grantDate
        );

        var certificationExpirationDates = rawBatchData.map(
          (item) => item.expirationDate
        );

        var holderNames = rawBatchData.map((item) => item.name);

        var certificationNames = rawBatchData.map(
          (item) => item.certificationName
        );

        var nonNullGrantDates = certificationGrantDates.filter(
          (date) => date == null || date == 1
        );
        var nonNullExpiryDates = certificationExpirationDates.filter(
          (date) => date == null
        );
        var notNullCertificationIDs = certificationIDs.filter(
          (item) => item == null
        );
        var notNullHolderNames = holderNames.filter((item) => item == null);
        var notNullCertificationNames = certificationNames.filter(
          (item) => item == null
        );

        if (
          nonNullGrantDates.length != 0 ||
          notNullCertificationIDs.length != 0 ||
          notNullHolderNames.length != 0 ||
          notNullCertificationNames.length != 0
        ) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgMissingDetailsInExcel,
          };
        }

        var checkValidateGrantDates = await validateGrantDates(
          certificationGrantDates
        );
        var checkValidateExpirationDates = await validateExpirationDates(
          certificationExpirationDates
        );

        if (
          checkValidateGrantDates.invalidDates.length > 0 ||
          checkValidateExpirationDates.invalidDates.length > 0
        ) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgInvalidDateFormat,
            Details: `Grant Dates ${checkValidateGrantDates.invalidDates}, Expiration Dates ${checkValidateExpirationDates.invalidDates}`,
          };
        }

        var certificationGrantDates = checkValidateGrantDates.validDates;
        var certificationExpirationDates =
          checkValidateExpirationDates.validDates;

        // Initialize an empty list to store matching IDs
        const matchingIDs = [];
        const repetitiveNumbers = await findRepetitiveIdNumbers(
          certificationIDs
        );
        const invalidIdList = await validateBatchCertificateIDs(
          certificationIDs
        );
        const invalidNamesList = await validateBatchCertificateNames(
          holderNames
        );

        if (invalidIdList != false) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgInvalidCertIds,
            Details: invalidIdList,
          };
        }

        if (invalidNamesList != false) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgOnlyAlphabets,
            Details: invalidNamesList,
          };
        }

        if (repetitiveNumbers.length > 0) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgExcelRepetetionIds,
            Details: repetitiveNumbers,
          };
        }

        const invalidGrantDateFormat = await findInvalidDates(
          certificationGrantDates
        );
        const invalidExpirationDateFormat = await findInvalidDates(
          certificationExpirationDates
        );

        if (
          invalidGrantDateFormat.invalidDates.length > 0 ||
          invalidExpirationDateFormat.invalidDates.length > 0
        ) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgInvalidDateFormat,
            Details: `Grant Dates ${invalidGrantDateFormat.invalidDates}, Expiration Dates ${invalidExpirationDateFormat.invalidDates}`,
          };
        }

        const validateCertificateDates = await compareGrantExpiredSetDates(
          invalidGrantDateFormat.validDates,
          invalidExpirationDateFormat.validDates
        );
        if (validateCertificateDates.length > 0) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgOlderDateThanNewDate,
            Details: `${validateCertificateDates}`,
          };
        }

        // Assuming BatchIssues is your MongoDB model
        for (const id of certificationIDs) {
          const issueExist = await isCertificationIdExisted(id);
          if (issueExist) {
            matchingIDs.push(id);
          }
        }

        if (matchingIDs.length > 0) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgExcelHasExistingIds,
            Details: matchingIDs,
          };
        }
        return {
          status: "SUCCESS",
          response: true,
          message: [targetData, rows.length, rows],
        };
      } else {
        return {
          status: "FAILED",
          response: false,
          message: messageCode.msgInvalidHeaders,
        };
      }
    } else {
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgExcelSheetname,
      };
    }
  } catch (error) {
    console.error("Error fetching record:", error);
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgProvideValidExcel,
    };
  }
};

const handleBulkExcelFile = async (_path) => {
  if (!_path) {
    return {
      status: "FAILED",
      response: false,
      message: "Failed to provide excel file",
    };
  }
  // api to fetch excel data into json
  const newPath = path.join(..._path.split("\\"));
  const sheetNames = await readXlsxFile.readSheetNames(newPath);
  if (sheetNames[0] != sheetName || sheetNames.length != 1) {
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgInvalidExcel,
      Details: sheetNames,
    };
  }
  try {
    if (sheetNames == "Batch" || sheetNames.includes("Batch")) {
      // api to fetch excel data into json
      const rows = await readXlsxFile(newPath, { sheet: "Batch" });
      // Check if the extracted headers match the expected pattern
      const isValidHeaders =
        JSON.stringify(rows[0]) === JSON.stringify(expectedBulkHeadersSchema);
      if (isValidHeaders) {
        const headers = rows.shift();
        const targetData = rows.map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj; // Return the fetched rows
        });

        // Limit Records to certain limit in the Batch
        if (rows && rows.length > cert_limit && cert_limit != 0) {
          return {
            status: "FAILED",
            response: false,
            message: `${messageCode.msgExcelLimit}: ${cert_limit}`,
            Details: `Input Records : ${rows.length}`,
          };
        }

        // Batch Certification Formated Details
        var rawBatchData = targetData;

        var certificationIDs = rawBatchData.map((item) => item.certificationID);

        var _certificationGrantDates = rawBatchData.map(
          (item) => item.grantDate
        );

        var _certificationExpirationDates = rawBatchData.map(
          (item) => item.expirationDate
        );

        var holderNames = rawBatchData.map((item) => item.name);

        var certificationNames = rawBatchData.map(
          (item) => item.certificationName
        );

        var nonNullGrantDates = _certificationGrantDates.filter(
          (date) => date == null
        );
        var nonNullExpiryDates = _certificationExpirationDates.filter(
          (date) => date == null
        );
        var notNullCertificationIDs = certificationIDs.filter(
          (item) => item == null
        );
        var notNullHolderNames = holderNames.filter((item) => item == null);
        var notNullCertificationNames = certificationNames.filter(
          (item) => item == null
        );

        if (
          nonNullGrantDates.length != 0 ||
          nonNullExpiryDates.length != 0 ||
          notNullCertificationIDs.length != 0 ||
          notNullHolderNames.length != 0 ||
          notNullCertificationNames.length != 0
        ) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgMissingDetailsInExcel,
            Details: "",
          };
        }

        var checkValidateGrantDates = await validateDates(
          _certificationGrantDates
        );
        var checkValidateExpirationDates = await validateDates(
          _certificationExpirationDates
        );

        if (
          checkValidateGrantDates.invalidDates.length > 0 ||
          checkValidateExpirationDates.invalidDates.length > 0
        ) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgInvalidDateFormat,
            Details: `Grant Dates ${checkValidateGrantDates.invalidDates}, Issued Dates ${checkValidateExpirationDates.invalidDates}`,
          };
        }

        var certificationGrantDates = checkValidateGrantDates.validDates;
        var certificationExpirationDates =
          checkValidateExpirationDates.validDates;

        // Initialize an empty list to store matching IDs
        const matchingIDs = [];
        const repetitiveNumbers = await findRepetitiveIdNumbers(
          certificationIDs
        );
        const invalidIdList = await validateBatchCertificateIDs(
          certificationIDs
        );
        const invalidNamesList = await validateBatchCertificateNames(
          holderNames
        );

        if (invalidIdList != false) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgInvalidCertIds,
            Details: invalidIdList,
          };
        }

        if (invalidNamesList != false) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgOnlyAlphabets,
            Details: invalidNamesList,
          };
        }

        if (repetitiveNumbers.length > 0) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgExcelRepetetionIds,
            Details: repetitiveNumbers,
          };
        }

        const invalidGrantDateFormat = await findInvalidDates(
          certificationGrantDates
        );
        const invalidExpirationDateFormat = await findInvalidDates(
          certificationExpirationDates
        );

        if (
          invalidGrantDateFormat.invalidDates.length > 0 ||
          invalidExpirationDateFormat.invalidDates.length > 0
        ) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgInvalidDateFormat,
            Details: `Grant Dates ${invalidGrantDateFormat.invalidDates}, Issued Dates ${invalidExpirationDateFormat.invalidDates}`,
          };
        }

        const validateCertificateDates = await compareGrantExpiredSetDates(
          invalidGrantDateFormat.validDates,
          invalidExpirationDateFormat.validDates
        );
        if (validateCertificateDates.length > 0) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgOlderDateThanNewDate,
            Details: `${validateCertificateDates}`,
          };
        }

        // Assuming BatchIssues is your MongoDB model
        for (const id of certificationIDs) {
          const issueExist = await isBulkCertificationIdExisted(id);
          if (issueExist) {
            matchingIDs.push(id);
          }
        }

        if (matchingIDs.length > 0) {
          return {
            status: "FAILED",
            response: false,
            message: messageCode.msgExcelHasExistingIds,
            Details: matchingIDs,
          };
        }

        return {
          status: "SUCCESS",
          response: true,
          message: [targetData, rows.length, rows],
        };
      } else {
        return {
          status: "FAILED",
          response: false,
          message: messageCode.msgInvalidHeaders,
        };
      }
    } else {
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgExcelSheetname,
      };
    }
  } catch (error) {
    console.error("Error fetching record:", error);
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgProvideValidExcel,
    };
  }
};

const handleBatchExcelFile = async (_path, issuer) => {
  if (!_path) {
    return {
      status: "FAILED",
      response: false,
      message: "Failed to provide excel file",
    };
  }
  // api to fetch excel data into json
  const newPath = path.join(..._path.split("\\"));
  const sheetNames = await readXlsxFile.readSheetNames(newPath);
  if (sheetNames[0] != sheetName || sheetNames.length != 1) {
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgInvalidExcel,
      Details: sheetNames,
    };
  }
  try {
    if (sheetNames == "Batch" || sheetNames.includes("Batch")) {
      // api to fetch excel data into json
      const rows = await readXlsxFile(newPath, { sheet: "Batch" });

      // Extract headers from the first row
      var headers = rows[0];

      // Limit the headers and data to the first 8 columns
      const maxColumns = 8;
      const limitedHeaders = headers.slice(0, maxColumns);

      // Map rows to JSON objects, restricting to the first 8 columns
      const jsonData = rows.slice(1).map((row) => {
        const rowData = {};
        limitedHeaders.forEach((header, index) => {
          rowData[header] = row[index] !== undefined ? row[index] : null; // handle undefined values
        });
        return rowData;
      });

      if (jsonData.length > 0) {
        let headers = rows.shift();

        const targetData = rows.map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj; // Return the fetched rows
        });

        // Limit Records to certain limit in the Batch
        if (rows && rows.length > cert_limit && cert_limit != 0) {
          return {
            status: "FAILED",
            response: false,
            message: `${messageCode.msgExcelLimit}: ${cert_limit}`,
            Details: `Input Records : ${rows.length}`,
          };
        }

        // Batch Certification Formated Details
        var rawBatchData = targetData;

        // define chunksize and concurency for queue processor
        // const { chunkSize, concurrency } = getChunkSizeAndConcurrency(
        //   rawBatchData.length
        // );
        
        const chunkSize = 10
        const concurrency = 2
        console.log(`chunk size : ${chunkSize} concurrency : ${concurrency}`);
        // Generate a batchId for this job processing
        const issuerId = new Date().getTime(); // Unique identifier (you can use other approaches too)

        const redisConfig = {
          redis: {
            port: process.env.REDIS_PORT || 6379, // Redis port (6380 from your env)
            host: process.env.REDIS_HOST || "localhost", // Redis host (127.0.0.1 from your env)
          },
        };
        const queueName = `bulkIssueExcelQueueProcessor${issuer}`;

        const bulkIssueExcelQueueProcessor = new Queue(queueName, redisConfig);

        bulkIssueExcelQueueProcessor.on("ready", () => {
          console.log("Queue is connected to Redis and ready to process jobs");
        });

        // Event listener to catch any connection errors
        bulkIssueExcelQueueProcessor.on("error", (error) => {
          console.error("Error connecting to Redis:", error);
        });
        bulkIssueExcelQueueProcessor.setMaxListeners(30);
        bulkIssueExcelQueueProcessor.process(concurrency, processListener)

        // Add jobs in chunks, passing batchId as part of job data
        const jobs = await addJobsInChunks(
          bulkIssueExcelQueueProcessor,
          rawBatchData,
          chunkSize,
          (chunk) => ({ chunk, issuerId }) // Include batchId in job data
        );
        try {
          await waitForJobsToComplete(jobs);
          await cleanUpJobs(bulkIssueExcelQueueProcessor);
        } catch (error) {
          return {
            status: 400,
            response: false,
            message: error.message || "Job processing failed.",
          };
        } finally {
          // Remove the process listener after processing jobs
          bulkIssueExcelQueueProcessor.removeAllListeners()
          console.log("bulkIssue queue listener remved... ");
        }
        console.log("all jobs for excel data completed...");

        return {
          status: "SUCCESS",
          response: true,
          message: [targetData, rows.length, rows],
        };
      } else {
        return {
          status: "FAILED",
          response: false,
          message: messageCode.msgInvalidHeaders,
        };
      }
    } else {
      return {
        status: "FAILED",
        response: false,
        message: messageCode.msgExcelSheetname,
      };
    }
  } catch (error) {
    console.error("Error fetching record:", error);
    return {
      status: "FAILED",
      response: false,
      message: messageCode.msgProvideValidExcel,
    };
  }
};


// Move the process listener outside of the function to avoid defining it multiple times
const processListener = async (job) => {
  const result = await processExcelJob(job);
  // Check the result and handle failures
  if (!result.response) {
    if (result.status === "FAILED") {
      const message = result.message + " " + result.Details;
      const error = new Error(message);
      throw error;
    }
  } else {
    console.log("Job processed successfully:", job.id);
  }
};

const validateDynamicBatchCertificateIDs = async (data) => {
  const invalidStrings = [];

  data.forEach((num) => {
    const str = num.toString(); // Convert number to string
    if (
      str.length < min_length ||
      str.length > max_length ||
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
    if (str.length > 40) {
      invalidNames.push(str);
    }
  });

  if (invalidNames.length > 0) {
    return invalidNames; // Return array of invalid strings
  } else {
    return false; // Return false if all strings are valid
  }
};

const validateBatchCertificateIDs = async (data) => {
  const invalidStrings = [];

  data.forEach((num) => {
    const str = num.toString(); // Convert number to string
    if (
      str.length < min_length ||
      str.length > max_length ||
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

const validateBatchCertificateNames = async (names) => {
  const invalidNames = [];

  names.forEach((name) => {
    const str = name.toString(); // Convert number to string
    if (str.length > 40) {
      invalidNames.push(str);
    }
  });

  if (invalidNames.length > 0) {
    return invalidNames; // Return array of invalid strings
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

// Function to compare two grant & expiration of dates
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

// Function to validate dates
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

// Function to validate dates
const validateGrantDates = async (dates) => {
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

// Function to validate dates
const validateExpirationDates = async (dates) => {
  const validDates = [];
  const invalidDates = [];
  for (const date of dates) {
    if (date == 1 || !date) {
      validDates.push(1);
    } else {
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
  }
  return { validDates, invalidDates };
};

const waitForJobsToComplete = async (jobs) => {
  try {
    // Wait for all jobs to finish
    await Promise.all(
      jobs.map((job) =>
        job.finished().catch((err) => {
          console.error("Job failed:", err.Details);
          throw err; // Propagate the error
        })
      )
    );
  } catch (error) {
    // Handle the error here if needed
    console.error("Error waiting for jobs to complete:", error);
    throw error; // Ensure the error is propagated
  }
};

module.exports = { handleExcelFile, handleBulkExcelFile, handleBatchExcelFile };
