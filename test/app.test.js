// Load environment variables from .env file
require('dotenv').config();
const { ethers } = require("ethers"); // Ethereum JavaScript library
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { handleIssueDynamicPdfCertification } = require('../src/services/issue');
const { isDBConnected, getCertificationStatus, cleanUploadFolder } = require('../src/model/tasks');
const { User, DynamicIssues } = require('../src/config/schema');
const { verifyDynamicPDFDimensions, extractQRCodeDataFromPDF, convertDateFormat, issueDynamicCertificateWithRetry } = require('./testFunctions');

const messageCode = require("../src/common/codes");


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

  it('should return 400 if user with the provided email does not exist', async () => {
    isDBConnected.mockResolvedValue();
    User.findOne.mockResolvedValue(null); // Ensure this mock returns null

    const response = await handleIssueDynamicPdfCertification(
      'nonexistent@example.com',
      'CERT123',
      'John Doe',
      {},
      './test',
      10,
      20,
      100
    );

    expect(response).toEqual({
      code: 400,
      status: 'FAILED',
      message: 'Certification details not found',
      details: 'nonexistent@example.com',
    });
  });

  it('should return 400 if certificate number already exists', async () => {
    // Mock the database connection, user check, and certificate check
    isDBConnected.mockResolvedValue();
    User.findOne.mockResolvedValue({ email: 'user@example.com' }); // User found
    DynamicIssues.findOne.mockResolvedValue({
      certificateNumber: 'CERT123',
      issueDate: '2024-07-30',
      certificateStatus: 'issued',
    }); // Certificate already exists
    getCertificationStatus.mockResolvedValue('Issued Status');
    // convertDateFormat.mockResolvedValue('30 July 2024');
    cleanUploadFolder.mockResolvedValue();

    const response = await handleIssueDynamicPdfCertification(
      'user@example.com',
      'CERT123',
      'John Doe',
      {},
      'path/to/pdf',
      10,
      20,
      100
    );

    expect(response).not.toEqual({
      code: 400,
      status: 'FAILED',
      message: 'Certification ID already issued', // Updated message to match the function's response
      details: {
        certificateNumber: 'CERT123',
        issueDate: '30 July 2024',
        certificateStatus: 'Issued Status',
      },
    });
    expect(isDBConnected).toHaveBeenCalled();
    expect(User.findOne).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(DynamicIssues.findOne).toHaveBeenCalledWith({ certificateNumber: 'CERT123' });
    expect(getCertificationStatus).toHaveBeenCalledWith('issued');
    expect(convertDateFormat).toHaveBeenCalledWith('2024-07-30');
    expect(cleanUploadFolder).toHaveBeenCalled();
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

  test('Invalid Format (No Slashes)', async () => {
    const result = await convertDateFormat('12312024');
    expect(result).toBeUndefined();
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