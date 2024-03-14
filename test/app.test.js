const { fetchExcelRecord } = require('../../batch_issue_git/src/model/tasks');
// const { checkBalance, batchCertificateIssue } = require('../../batch_issue_git/src/controllers/controllers'); // Import the function to be tested
const xlsx = require('xlsx'); // Library for creating test Excel files
const { ethers } = require('ethers'); // Import ethers for mocking
const fs = require('fs'); // File system module


// Test suite for fetchExcelRecord function
describe('fetchExcelRecord', () => {
    // Test case for valid Excel file with correct sheet name and headers
    it('should return SUCCESS for valid Excel file', async () => {
      // Define test data
      const testData = [
        ["certificationID", "name", "certificationName", "grantDate", "expirationDate"],
        [15792100, "Alice", "AI Advanced", "12/12/23", "12/12/25"],
        [15792101, "Bob", "AI Advanced +", "12/12/23", "12/12/25"],
        [15792102, "John", "AI Advanced +", "12/12/23", "12/12/25"]
      ];
  
      // Create a workbook and add test data to a sheet named "Batch"
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(testData);
      xlsx.utils.book_append_sheet(wb, ws, "Batch");
  
      // Write workbook to a temporary file
      const tempFilePath = './test.xlsx';
      xlsx.writeFile(wb, tempFilePath);
  
      // Call the function with the temporary file path
      const result = await fetchExcelRecord(tempFilePath);
  
      // Assert the result
      expect(result.status).toBe("SUCCESS");
      expect(result.response).toBe(true);
      expect(result.message.length).toBe(3);
      expect(result.message[0]).toEqual([
        { certificationID: 15792100, name: "Alice", certificationName:  "AI Advanced", grantDate: "12/12/23" , expirationDate: "12/12/25"},
        { certificationID: 15792101, name: "Bob", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" },
        { certificationID: 15792102, name: "John", certificationName:  "AI Advanced +", grantDate: "12/12/23" , expirationDate: "12/12/25" }
      ]);
      expect(result.message[1]).toBe(3);
      expect(result.message[2].length).toBe(3);
  
      // Delete the temporary file
      fs.unlinkSync(tempFilePath);
    });
  // Add more test cases for different scenarios such as invalid file, missing sheet, etc.
  });
