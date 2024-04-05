// Load environment variables from .env file
require('dotenv').config();

const readXlsxFile = require('read-excel-file/node');

const thresholdYear = parseInt(process.env.THRESHOLD_YEAR);
// Parse environment variables for password length constraints
const min_length = parseInt(process.env.MIN_LENGTH);
const max_length = parseInt(process.env.MAX_LENGTH);

const handleExcelFile = async (_path) => {

    if (!_path || _path.length < 0) {
        return { status: "FAILED", response: false, message: "Invalid Excel file." };
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

                return { status: "SUCCESS", response: true, message: [targetData, rows.length, rows] };

            } else {
                return { status: "FAILED", response: false, message: "Invalid headers in the Excel file." };
            }
        } else {
            return { status: "FAILED", response: false, message: "The Excel Sheet name should be - Batch." };
        }

    } catch (error) {
        console.error('Error fetching record:', error);
        throw error; // Rethrow the error for handling it in the caller function

    }
};

const validateBatchCertificateIDs = async (data) => {
    const invalidStrings = [];

    data.forEach(num => {
        const str = num.toString(); // Convert number to string
        if (str.length < 12 || str.length > 20) {
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
  
      // Create Date objects for comparison
      const grantDate = new Date(`20${grantDateParts[2]}`, grantDateParts[0] - 1, grantDateParts[1]);
      const expirationDate = new Date(`20${expirationDateParts[2]}`, expirationDateParts[0] - 1, expirationDateParts[1]);
  
      if (grantDate > expirationDate) {
        dateSets.push(grantList[i], expirationList[i] + " at index " + i);
      }
    }
  
    return dateSets;
  };


module.exports = { handleExcelFile };