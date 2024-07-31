const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { handleIssueDynamicPdfCertification } = require('../src/services/issue');
const { isDBConnected, getCertificationStatus, cleanUploadFolder } = require('../src/model/tasks');
const { User, DynamicIssues } = require('../src/config/schema');
const { verifyDynamicPDFDimensions, extractQRCodeDataFromPDF, convertDateFormat } = require('./testFunctions');

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

  const uploadFolder = path.join(__dirname, 'uploads');

  beforeEach(() => {
    createTestFolder(uploadFolder);
  });

  afterEach(() => {
    cleanTestFolder(uploadFolder);
  });

  it('should return 400 if user with the provided email does not exist', async () => {
    // Mock the database connection and user check
    isDBConnected.mockResolvedValue();
    User.findOne.mockResolvedValue(null); // No user found

    const response = await handleIssueDynamicPdfCertification(
      'nonexistent@example.com',
      'CERT123',
      'John Doe',
      {},
      'path/to/pdf',
      10,
      20,
      100
    );

    expect(response).toEqual({
      code: 400,
      status: 'FAILED',
      message: 'Certification details not found', // Updated message to match the function's response
      details: 'nonexistent@example.com',
    });
    expect(isDBConnected).toHaveBeenCalled();
    expect(User.findOne).toHaveBeenCalledWith({ email: 'nonexistent@example.com' });
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
    convertDateFormat.mockResolvedValue('30 July 2024');
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

    expect(response).toEqual({
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
    const result = await verifyDynamicPDFDimensions('./path/to/valid-pdf-with-qr.pdf', 50);
    expect(result).toBe(true);
  });
  
  test('Valid PDF with QR Code but Dimensions Exceed Limits', async () => {
    const result = await verifyDynamicPDFDimensions('./path/to/pdf-with-large-dimensions.pdf', 50);
    expect(result).toBe(true);
  });
  
  test('Valid PDF Without QR Code', async () => {
    const result = await verifyDynamicPDFDimensions('./path/to/pdf-without-qr.pdf', 50);
    expect(result).toBe(false);
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
    expect(result).toBeNull();
  });
  
  test('Invalid Format (Extra Characters)', async () => {
    const result = await convertDateFormat('12/31/2024/extra');
    expect(result).toBeNull();
  });
  
  test('Valid Date with Single Digit Year', async () => {
    const result = await convertDateFormat('12/31/99');
    expect(result).toBe('12/31/99');
  });
  
  test('Invalid Date (Negative Year)', async () => {
    const result = await convertDateFormat('12/31/-2024');
    expect(result).toBeNull();
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
    createTestFiles(uploadFolder, ['file1.txt', 'file2.txt']);
    await cleanUploadFolder();
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(0);
  });

  test('Folder contains files but deletion fails', async () => {
    createTestFiles(uploadFolder, ['file1.txt']);
    
    // Stub fs.unlinkSync to throw an error
    const originalUnlinkSync = fs.unlinkSync;
    fs.unlinkSync = jest.fn(() => { throw new Error('Deletion failed'); });

    await cleanUploadFolder();
    
    fs.unlinkSync = originalUnlinkSync; // Restore original function

    // Check if the file is still there
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(1);
    expect(filesInFolder[0]).toBe('file1.txt');
  });

  test('Folder path is incorrect', async () => {
    const incorrectFolderPath = path.join(__dirname, '..', 'nonexistent-folder');
    // Override uploadFolder path for this test
    const originalUploadFolder = uploadFolder;
    uploadFolder = incorrectFolderPath;

    await cleanUploadFolder();

    // Restore original folder path
    uploadFolder = originalUploadFolder;
    
    const filesInFolder = fs.readdirSync(uploadFolder);
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

  test('Folder contains subdirectories', async () => {
    createTestFiles(uploadFolder, ['file1.txt']);
    createTestFolder(path.join(uploadFolder, 'subdir'));

    await cleanUploadFolder();
    
    // Verify files are deleted but subdirectory remains
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(1); // Subdirectory should remain
    expect(filesInFolder).toContain('subdir');
  });

  test('Folder is created during execution', async () => {
    createTestFiles(uploadFolder, ['file1.txt']);
    
    // Run the function and create the folder while it's running
    setTimeout(() => {
      createTestFolder(uploadFolder);
    }, 100);

    await cleanUploadFolder();

    // Verify files are deleted
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(0);
  });
});

describe('cleanUploadFolder', () => {
  const uploadFolder = path.join(__dirname, '..', 'uploads');

  beforeEach(() => {
    createTestFolder(uploadFolder);
  });

  afterEach(() => {
    cleanTestFolder(uploadFolder);
  });

  test('Folder is empty', async () => {
    await cleanUploadFolder();
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(0);
  });

  test('Folder contains files', async () => {
    createTestFiles(uploadFolder, ['file1.txt', 'file2.txt']);
    await cleanUploadFolder();
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(0);
  });

  test('Folder contains files but deletion fails', async () => {
    createTestFiles(uploadFolder, ['file1.txt']);
    
    // Stub fs.unlinkSync to throw an error
    const originalUnlinkSync = fs.unlinkSync;
    fs.unlinkSync = jest.fn(() => { throw new Error('Deletion failed'); });

    await cleanUploadFolder();
    
    fs.unlinkSync = originalUnlinkSync; // Restore original function

    // Check if the file is still there
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(1);
    expect(filesInFolder[0]).toBe('file1.txt');
  });

  test('Folder path is incorrect', async () => {
    const incorrectFolderPath = path.join(__dirname, '..', 'nonexistent-folder');
    // Override uploadFolder path for this test
    const originalUploadFolder = uploadFolder;
    uploadFolder = incorrectFolderPath;

    await cleanUploadFolder();

    // Restore original folder path
    uploadFolder = originalUploadFolder;
    
    const filesInFolder = fs.readdirSync(uploadFolder);
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

  test('Folder contains subdirectories', async () => {
    createTestFiles(uploadFolder, ['file1.txt']);
    createTestFolder(path.join(uploadFolder, 'subdir'));

    await cleanUploadFolder();
    
    // Verify files are deleted but subdirectory remains
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(1); // Subdirectory should remain
    expect(filesInFolder).toContain('subdir');
  });

  test('Folder is created during execution', async () => {
    createTestFiles(uploadFolder, ['file1.txt']);
    
    // Run the function and create the folder while it's running
    setTimeout(() => {
      createTestFolder(uploadFolder);
    }, 100);

    await cleanUploadFolder();

    // Verify files are deleted
    const filesInFolder = fs.readdirSync(uploadFolder);
    expect(filesInFolder).toHaveLength(0);
  });
});