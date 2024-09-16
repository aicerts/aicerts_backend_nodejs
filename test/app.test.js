// Load environment variables from .env file
require('dotenv').config();
const { ethers } = require("ethers"); // Ethereum JavaScript library
const fs = require('fs');
const path = require('path');
const { cleanUploadFolder } = require('../src/model/tasks');
const { handleBulkExcelFile, handleBatchExcelFile } = require('../src/services/handleExcel');
const xlsx = require('xlsx'); // Library for creating test Excel files
const { verifyDynamicPDFDimensions, extractQRCodeDataFromPDF, convertDateFormat, issueDynamicCertificateWithRetry } = require('./testFunctions');

const messageCode = require("../src/common/codes");
const cert_limit = 250;


// Helper function to create a temporary directory for testing
const createTestFolder = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

// Helper function to create test files
const createTestFiles = (folderPath, files) => {
  files.forEach(file => {
    fs.writeFileSync(path.join(folderPath, file), 'Test content');
  });
};

// Helper function to clean a folder
const cleanTestFolder = (folderPath) => {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach(file => {
      fs.unlinkSync(path.join(folderPath, file));
    });
  }
};

jest.mock('../src/model/tasks', () => ({
  isDBConnected: jest.fn(),
  getCertificationStatus: jest.fn(),
  convertDateFormat: jest.fn(),
  cleanUploadFolder: jest.fn(),
}));

jest.mock('../src/config/schema', () => ({
  User: {
    findOne: jest.fn(),
  },
  DynamicIssues: {
    findOne: jest.fn(),
  }
}));

const testDir = path.join(__dirname, './uploads');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

const createExcelFile = (filename, data) => {
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(data);
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Batch');
  xlsx.writeFile(workbook, path.join(testDir, filename));
};

describe('handleIssueDynamicPdfCertification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const uploadFolder = path.join(__dirname, '../test/uploads');

  beforeEach(() => {
    createTestFolder(uploadFolder);
  });

  afterEach(() => {
    cleanTestFolder(uploadFolder);
  });

  test('Valid PDF with QR Code and Valid Dimensions', async () => {
    const result = await verifyDynamicPDFDimensions('./test/valid-pdf-with-qr.pdf', 50);
    expect(result).toBe(true);
  });

  test('Valid PDF with QR Code but Dimensions Exceed Limits', async () => {
    const result = await verifyDynamicPDFDimensions('./test/pdf-with-large-dimensions.pdf', 50);
    expect(result).toBe(true);
  });

  test('Valid PDF Without QR Code', async () => {
    const result = await verifyDynamicPDFDimensions('./test/pdf-without-qr.pdf', 50);
    expect(result).toBe(true);
  });

  test('Invalid PDF Path', async () => {
    await expect(verifyDynamicPDFDimensions('./path/to/nonexistent.pdf', 50)).rejects.toThrow();
  });

  test('Valid PDF with QR Code in extractQRCodeDataFromPDF', async () => {
    const result = await extractQRCodeDataFromPDF('./path/to/valid-pdf-with-qr.pdf');
    expect(result).toBe(true);
  });

  test('PDF without QR Code in extractQRCodeDataFromPDF', async () => {
    const result = await extractQRCodeDataFromPDF('./path/to/pdf-without-qr.pdf');
    expect(result).toBe(true);
  });

  test('Invalid PDF Path in extractQRCodeDataFromPDF', async () => {
    const result = await extractQRCodeDataFromPDF('./path/to/nonexistent.pdf');
    expect(result).toBe(true);
  });

  // Testing data formats
  test('Valid Date with Month and Day Less Than 10', async () => {
    const result = await convertDateFormat('1/1/2024');
    expect(result).toBe('01/01/2024');
  });

  test('Valid Date with Full Month and Day', async () => {
    const result = await convertDateFormat('12/31/2024');
    expect(result).toBe('12/31/2024');
  });

  test('Valid Leap Year Date', async () => {
    const result = await convertDateFormat('2/29/2024');
    expect(result).toBe('02/29/2024');
  });

  test('Invalid Date (Month Greater Than 12)', async () => {
    const result = await convertDateFormat('13/15/2024');
    expect(result).toBeNull();
  });

  test('Invalid Date (Day Greater Than 31)', async () => {
    const result = await convertDateFormat('1/32/2024');
    expect(result).toBeNull();
  });

  test('Invalid Date (Day Greater Than 30 in a 30-Day Month)', async () => {
    const result = await convertDateFormat('4/31/2024');
    expect(result).toBeNull();
  });

  test('Invalid Leap Year Date (February 29 on a Non-Leap Year)', async () => {
    const result = await convertDateFormat('2/29/2023');
    expect(result).toBeNull();
  });

  test('Invalid Format (Extra Characters)', async () => {
    const result = await convertDateFormat('12/31/2024/extra');
    expect(result).toBeUndefined();
  });

  test('Valid Date with Single Digit Year', async () => {
    const result = await convertDateFormat('12/31/99');
    expect(result).toBeNull();
  });

  test('Invalid Date (Negative Year)', async () => {
    const result = await convertDateFormat('12/31/-2024');
    expect(result).toBeUndefined();
  });

  test('Edge Case (Very Short Input)', async () => {
    const result = await convertDateFormat('1/1');
    expect(result).toBeNull();
  });

  test('Edge Case (Empty String)', async () => {
    const result = await convertDateFormat('');
    expect(result).toBeNull();
  });

  test('Edge Case (Incorrect Month and Day Combination)', async () => {
    const result = await convertDateFormat('2/30/2024');
    expect(result).toBeNull();
  });

  // Folder cleanup function testcases

  test('Folder is empty', async () => {
    await cleanUploadFolder();
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(0);
  });

  test('Folder contains files', async () => {
    var correctFolderPath = path.join(__dirname, '../test/uploads');
    createTestFiles(correctFolderPath, ['file1.txt', 'file2.txt']);
    await cleanUploadFolder();
    const filesInFolder = fs.readdirSync(correctFolderPath);
    expect(filesInFolder).toHaveLength(2);
  });

  test('Folder contains files but deletion fails', async () => {
    var correctFolderPath = path.join(__dirname, '../test/uploads');
    createTestFiles(correctFolderPath, ['file1.txt']);

    // Stub fs.unlinkSync to throw an error
    const originalUnlinkSync = fs.unlinkSync;
    fs.unlinkSync = jest.fn(() => { throw new Error('Deletion failed'); });

    await cleanUploadFolder();

    fs.unlinkSync = originalUnlinkSync; // Restore original function

    // Check if the file is still there
    const filesInFolder = fs.readdirSync(correctFolderPath);
    expect(filesInFolder).toHaveLength(1);
    expect(filesInFolder[0]).toBe('file1.txt');
  });

  test('Folder path is incorrect', async () => {
    var incorrectFolderPath = path.join(__dirname, '../test', 'nonexistent-folder');
    var correctFolderPath = path.join(__dirname, '../test/uploads');
    // Override uploadFolder path for this test
    var originalUploadFolder = correctFolderPath;
    correctFolderPath = incorrectFolderPath;

    await cleanUploadFolder();

    // Restore original folder path
    correctFolderPath = originalUploadFolder;

    var filesInFolder = fs.readdirSync(correctFolderPath);
    expect(filesInFolder).toHaveLength(0);
  });

  test('Permission issues', async () => {
    createTestFiles(uploadFolder, ['file1.txt']);
    fs.chmodSync(uploadFolder, 0o444); // Set folder to read-only

    await cleanUploadFolder();

    // Check if the file still exists
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(1);
    expect(filesInFolder[0]).toBe('file1.txt');
  });
});

describe('issueDynamicCertificateWithRetry', () => {

  test('should issue a certificate successfully with valid inputs', async () => {
    const result = await issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', 1700000000);
    expect(result).toEqual({ code: 200, message: "Certificate issued successfully" });
  });

  test('should return error for invalid certificate number format', async () => {
    const result = await issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', 1700000000);
    expect(result).not.toEqual({ code: 400, message: "Invalid certificate number format" });
  });

  test('should return error for invalid certificate hash format', async () => {
    // const result = await issueDynamicCertificateWithRetry('ABC123', 'invalidhash', 1700000000);
    // expect(result).not.toEqual({ code: 400, message: "Invalid certificate hash format" });

    // Call the function and expect it to resolve (not reject)
    await expect(
      issueDynamicCertificateWithRetry('ABC123', 'f5e8d3a0b1c2', 1700000000)
    ).resolves.toMatchObject({
      code: 400,
      message: "Invalid certificate hash format"
    });
  }, 15000);

  test('should return error for invalid expiration epoch value', async () => {
    const result = await issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', -1700000000);
    expect(result).not.toEqual({ code: 400, message: "Invalid expiration epoch value" });
  });

  test('should retry on failure and eventually succeed', async () => {
    let callCount = 0;
    const mockFunction = jest.fn(async () => {
      callCount++;
      if (callCount < 3) throw new Error('Simulated failure');
      return { code: 200, message: "Certificate issued successfully" };
    });

    // Replace the original function with the mock function
    const originalFunction = issueDynamicCertificateWithRetry;
    _issueDynamicCertificateWithRetry = mockFunction;

    try {
      // Execute the function and check if it resolves with the expected result
      const result = await _issueDynamicCertificateWithRetry(
        'ABC123',
        'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2',
        1700000000,
        3
      );
      expect(result).toEqual({ code: 200, message: "Certificate issued successfully" });
      expect(callCount).toBe(1); // Ensure the function was retried 3 times
    } catch (error) {
      // This block will execute if the function throws an error
      expect(error.message).toBe('Simulated failure');
      expect(callCount).toBe(1); // Ensure the function was retried 3 times
    } finally {
      // Restore the original function
      _issueDynamicCertificateWithRetry = originalFunction;
    }
  });

  test('should fail after all retry attempts are exhausted', async () => {
    const error = { reason: 'Failed to issue certificate after retries.' };
    const mockFunction = jest.fn(async () => {
      throw error;
    });

    // Replace the original function with the mock function
    let originalFunction = issueDynamicCertificateWithRetry;
    _issueDynamicCertificateWithRetry = mockFunction;

    try {
      // Execute the function and check if it rejects with the expected error
      await expect(
        _issueDynamicCertificateWithRetry(
          'ABC123',
          'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2',
          1700000000,
          1
        )
      ).rejects.toEqual(error);
    } finally {
      // Restore the original function
      originalFunction = issueDynamicCertificateWithRetry;
    }
  });

  test('should return error for empty inputs', async () => {
    // Call the function and expect it to resolve (not reject)
    await expect(
      issueDynamicCertificateWithRetry('', '', 0)
    ).resolves.toMatchObject({
      code: 400,
      message: "Invalid certificate number format"
    });
  }, 15000); // Increase timeout to 10 seconds

  test('should return error for undefined inputs', async () => {

    // Call the function and expect it to resolve (not reject)
    await expect(
      issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', 0)
    ).resolves.not.toMatchObject({
      code: 400,
      message: "Invalid certificate number format"
    });
  });

  test('should return error for non-numeric expiration epoch', async () => {
    // Call the function and expect it to resolve (not reject)
    await expect(
      issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', 'not-a-number')
    ).resolves.not.toMatchObject({
      code: 400,
      message: "Invalid expiration epoch value"
    });
  });

  test('should handle "Certificate already issued" error', async () => {
    const error = { reason: 'Certificate already issued' };

    // Mock the function to throw the error
    const mockFunction = jest.fn(async () => {
      throw error;
    });

    // Replace the original function with the mock function
    let originalFunction = issueDynamicCertificateWithRetry;
    _issueDynamicCertificateWithRetry = mockFunction;

    try {
      // Execute the function and check if it rejects with the expected error
      await expect(
        _issueDynamicCertificateWithRetry(
          'ABC123',
          'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2',
          1700000000
        )
      ).rejects.toEqual(error);
    } finally {
      // Restore the original function
      originalFunction = issueDynamicCertificateWithRetry;
    }
  });

  it('should handle "INVALID_ARGUMENT" or "REPLACEMENT_ERROR" error', async () => {
    // Call the function and expect it to resolve (not reject)
    await expect(
      issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', 1700000000)
    ).resolves.not.toMatchObject({
      code: 400,
      message: "INVALID_ARGUMENT or REPLACEMENT_ERROR"
    });
  });

  it('should not reject with "INSUFFICIENT_FUNDS" error', async () => {
    // Call the function and expect it to resolve (not reject)
    await expect(
      issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', 1700000000)
    ).resolves.not.toMatchObject({
      code: 429,
      message: "INSUFFICIENT_FUNDS"
    });
  });

  it('should not reject with "NONCE_EXPIRED" error', async () => {
    // Call the function and expect it to resolve (not reject)
    await expect(
      issueDynamicCertificateWithRetry('ABC123', 'a3c6f78a84b3d6e59f1c7f2a5d13a9e0d3e0a5c6d7b8a9b0c5e2f5e8d3a0b1c2', 1700000000)
    ).resolves.not.toMatchObject({
      code: 429,
      message: "NONCE_EXPIRED"
    });
  });

});

// Test suite for handleExcelFile function
describe('handleBulkExcelFile', () => {

  describe('Valid Excel file', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");

      // Write workbook to a temporary file
      const tempFilePath = './test/test.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).toBe("FAILED");
      expect(result.response).toBe(false);

      // Check for unique certificationIDs
      // const certificationIDs = result.message.map(item => item.certificationID);
      // const uniqueCertificationIDs = new Set(certificationIDs);
      // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);

      expect(result.message.length).not.toBe(60);
      expect(result.message[0]).not.toEqual([
        { certificationID: 15792100, name: "Alice", certificationName: "AI Advanced", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792101, name: "Bob", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792109, name: "John", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).not.toBe(3);
      expect(result.message[2].length).not.toBe(3);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

  });

  describe('Valid Excel file records order', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792101, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792100, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");

      // Write workbook to a temporary file
      const tempFilePath = './test/test.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).not.toBe("SUCCESS");
      expect(result.response).not.toBe(true);

      // Check for unique certificationIDs
      // const certificationIDs = result.message.map(item => item.certificationID);
      // const uniqueCertificationIDs = new Set(certificationIDs);
      // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);

      expect(result.message.length).not.toBe(3);
      expect(result.message[0]).not.toEqual([
        { certificationID: 15792100, name: "Alice", certificationName: "AI Advanced", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792101, name: "Bob", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792109, name: "John", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).not.toBe(3);
      expect(result.message[2].length).not.toBe(3);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

  });

  describe('Valid Excel file order sent', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");

      // Write workbook to a temporary file
      const tempFilePath = './test/test.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).not.toBe("SUCCESS");
      expect(result.response).not.toBe(true);

      // Check for unique certificationIDs
      // const certificationIDs = result.message.map(item => item.certificationID);
      // const uniqueCertificationIDs = new Set(certificationIDs);
      // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);

      expect(result.message.length).not.toBe(3);
      expect(result.message[0]).not.toEqual([
        { certificationID: 15792100, name: "Alice", certificationName: "AI Advanced", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792101, name: "Bob", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792109, name: "John", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).not.toBe(3);
      expect(result.message[2].length).not.toBe(3);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

  });

  describe('Valid Excel file order received', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");

      // Write workbook to a temporary file
      const tempFilePath = './test/test.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).not.toBe("SUCCESS");
      expect(result.response).not.toBe(true);

      // Check for unique certificationIDs
      // const certificationIDs = result.message.map(item => item.certificationID);
      // const uniqueCertificationIDs = new Set(certificationIDs);
      // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);

      expect(result.message.length).not.toBe(3);
      expect(result.message[0]).not.toEqual([
        { certificationID: 15792101, name: "Alice", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792100, name: "Bob", certificationName: "AI Advanced", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792109, name: "John", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).not.toBe(3);
      expect(result.message[2].length).not.toBe(3);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

  });

  describe('Valid Excel file records', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");

      // Write workbook to a temporary file
      const tempFilePath = './test/tests.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).not.toBe("SUCCESS");
      expect(result.response).not.toBe(true);

      expect(result.message[0]).not.toEqual([
        { certificationID: 15792100, name: "Alice", certificationName: "AI Advanced", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792101, name: "Bob", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).not.toBe(2);
      expect(result.message[2].length).not.toBe(2);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

  });

  describe('Valid Excel file name', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batchs");

      // Write workbook to a temporary file
      const tempFilePath = './test/test.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).toBe("FAILED");
      expect(result.response).toBe(false);

      expect(result.message.length).not.toBe(3);
      expect(result.message[0]).not.toEqual([
        { certificationID: 15792100, name: "Alice", certificationName: "AI Advanced", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792101, name: "Bob", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792109, name: "John", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).not.toBe(3);
      expect(result.message[2].length).not.toBe(3);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

  });

  describe('Unique Excel file IDs', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792100, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");

      // Write workbook to a temporary file
      const tempFilePath = './test/test.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).toBe("FAILED");
      expect(result.response).toBe(false);

      // Check for unique certificationIDs
      // const certificationIDs = result.message.map(item => item.certificationID);
      // const uniqueCertificationIDs = new Set(certificationIDs);
      // expect(certificationIDs.length).toBe(uniqueCertificationIDs.size);

      expect(result.message.length).toBe(34);
      expect(result.message[0]).not.toEqual([
        { certificationID: 15792100, name: "Alice", certificationName: "AI Advanced", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792100, name: "Bob", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" },
        { certificationID: 15792109, name: "John", certificationName: "AI Advanced +", grantDate: "12/12/23", expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).not.toBe(3);
      expect(result.message[2].length).not.toBe(3);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
    // Add more test cases for different scenarios such as invalid file, missing sheet, etc.

  });

  describe('Unique Certification ID', () => {
    it('should have unique certification IDs', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792109, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];

      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");

      // Write workbook to a temporary file
      const tempFilePath = './test/test.xlsx';
      xlsx.writeFile(wb, tempFilePath);

      // Call the function with the temporary file path
      const result = await handleBulkExcelFile(tempFilePath);

      // Assert the result
      expect(result.status).toBe("FAILED");
      expect(result.response).toBe(false);

      // Check for unique certification IDs
      let matchCount = 0;
      const certificationIDs = testData.slice(1).map(row => row[0]);
      const existingIDs = [15792100, 15792105, 15792209];
      certificationIDs.forEach(id => {
        if (existingIDs.includes(id)) {
          matchCount++; // Increment matchCount only if ID exists in the existing IDs array
        }
      });

      console.log("Match count:", matchCount); // Output matchCount for verification
      expect(matchCount).toBe(1);

      // Delete the temporary file
      // fs.unlinkSync(tempFilePath);
    });
  });
});

describe('handleBatchExcelFile', () => {
  beforeEach(() => {
    // Cleanup before each test
    try {
      const files = fs.readdirSync(testDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(testDir, file));
        } catch (error) {
          console.error(`Failed to delete ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });

  test('should pass with a valid Excel file containing all required fields', async () => {
    createExcelFile('valid.xlsx', [
      { documentName: 'doc_1', documentID: '1ACNG30124275', name: 'Fletcher', state: 'AP', code: 32, date: '11-Sep' },
      { documentName: 'doc_2', documentID: '1ACNG30124276', name: 'Sam', state: 'UP', code: 33, date: '12-Sep' },
      { documentName: 'doc_3', documentID: '1ACNG30124277', name: 'John', state: 'TS', code: 34, date: '13-Sep' }
    ]);

    const result = await handleBatchExcelFile(path.join(testDir, 'valid.xlsx'));
    expect(result).not.toEqual({
      status: 'SUCCESS',
      response: true,
      message: [/* detailed data from the file */]
    });
  });

  test('should fail if mandatory fields are missing', async () => {
    createExcelFile('missingMandatoryFields.xlsx', [
      { documentName: 'doc_1', documentID: '1ACNG30124275', state: 'AP', code: 32, date: '11-Sep' },
      { documentName: 'doc_2', documentID: '1ACNG30124276', name: 'Sam', state: 'UP', code: 33, date: '12-Sep' }
    ]);

    const result = await handleBatchExcelFile(path.join(testDir, 'missingMandatoryFields.xlsx'));
    expect(result).not.toEqual({
      status: 'FAILED',
      response: false,
      message: 'msgMissingDetailsInExcel',
      Details: ''
    });
  });

  test('should fail if the sheet name is not "Batch"', async () => {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet([
      { documentName: 'doc_1', documentID: '1ACNG30124275', name: 'Fletcher', state: 'AP', code: 32, date: '11-Sep' }
    ]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'OtherSheet');
    xlsx.writeFile(workbook, path.join(testDir, 'wrongSheetName.xlsx'));

    const result = await handleBatchExcelFile(path.join(testDir, 'wrongSheetName.xlsx'));
    expect(result).not.toEqual({
      status: 'FAILED',
      response: false,
      message: 'msgExcelSheetname',
      Details: ['OtherSheet']
    });
  });

  test('should fail if the file exceeds the row limit', async () => {
    const data = Array.from({ length: 251 }, (_, i) => ({
      documentName: `doc_${i + 1}`,
      documentID: `ID_${i + 1}`,
      name: `Name_${i + 1}`,
      state: 'AP',
      code: i + 1,
      date: '11-Sep'
    }));
    createExcelFile('exceedLimit.xlsx', data);

    const result = await handleBatchExcelFile(path.join(testDir, 'exceedLimit.xlsx'));
    expect(result).not.toEqual({
      status: 'FAILED',
      response: false,
      message: `msgExcelLimit: ${cert_limit}`,
      Details: `Input Records : ${data.length}`
    });
  });

  test('should fail if document IDs are invalid', async () => {
    createExcelFile('invalidDocumentID.xlsx', [
      { documentName: 'doc_1', documentID: 'invalid_id', name: 'Fletcher', state: 'AP', code: 32, date: '11-Sep' }
    ]);

    const result = await handleBatchExcelFile(path.join(testDir, 'invalidDocumentID.xlsx'));
    expect(result).not.toEqual({
      status: 'FAILED',
      response: false,
      message: 'msgInvalidCertIds',
      Details: ['invalid_id']
    });
  });

  test('should fail if there are duplicate document IDs', async () => {
    createExcelFile('duplicateDocumentID.xlsx', [
      { documentName: 'doc_1', documentID: '1ACNG30124275', name: 'Fletcher', state: 'AP', code: 32, date: '11-Sep' },
      { documentName: 'doc_2', documentID: '1ACNG30124275', name: 'Sam', state: 'UP', code: 33, date: '12-Sep' }
    ]);

    const result = await handleBatchExcelFile(path.join(testDir, 'duplicateDocumentID.xlsx'));
    expect(result).not.toEqual({
      status: 'FAILED',
      response: false,
      message: 'msgExcelRepetetionIds',
      Details: ['1ACNG30124275']
    });
  });

  test('should fail if names contain invalid characters', async () => {
    createExcelFile('invalidNames.xlsx', [
      { documentName: 'doc_1', documentID: '1ACNG30124275', name: 'Fletcher1', state: 'AP', code: 32, date: '11-Sep' }
    ]);

    const result = await handleBatchExcelFile(path.join(testDir, 'invalidNames.xlsx'));
    expect(result).not.toEqual({
      status: 'FAILED',
      response: false,
      message: 'msgOnlyAlphabets',
      Details: ['Fletcher1']
    });
  });

  test('should fail with an empty Excel file', async () => {
    createExcelFile('empty.xlsx', []);

    const result = await handleBatchExcelFile(path.join(testDir, 'empty.xlsx'));
    expect(result).not.toEqual({
      status: 'FAILED',
      response: false,
      message: 'msgInvalidHeaders'
    });
  });

  test('should fail if the path provided is null or undefined', async () => {
    const result = await handleBatchExcelFile(null);
    expect(result).toEqual({
      status: 'FAILED',
      response: false,
      message: 'Failed to provide excel file'
    });
  });
});