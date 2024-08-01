import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises'; // Use the promises API for async file operations
import * as xml2js from 'xml2js';
import * as csv from 'csv-parse/sync'; // Use synchronous API for simplicity

async function convertToExcel(inputFile: string, outputFile: string) {
  const fileExtension = inputFile.split('.').pop()?.toLowerCase();
  let data: any[];

  try {
    switch (fileExtension) {
      case 'xml':
        data = await parseXML(inputFile);
        break;
      case 'json':
        data = await parseJSON(inputFile);
        break;
      case 'csv':
        data = await parseCSV(inputFile);
        break;
      default:
        throw new Error('Unsupported file format');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    // Add headers
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);
    }

    // Add data
    data.forEach(row => {
      worksheet.addRow(Object.values(row));
    });

    await workbook.xlsx.writeFile(outputFile);

    console.log(`Conversion complete. Excel file saved as ${outputFile}`);
  } catch (error) {
    console.error('Error during conversion:', error);
  }
}

async function parseXML(filePath: string): Promise<any[]> {
  const xmlData = await fs.readFile(filePath, 'utf-8');
  const parser = new xml2js.Parser({ explicitArray: false });

  return new Promise((resolve, reject) => {
    parser.parseString(xmlData, (err, result) => {
      if (err) reject(err);
      else resolve(Array.isArray(result) ? result : [result]);
    });
  });
}

async function parseJSON(filePath: string): Promise<any[]> {
  const jsonData = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(jsonData);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function parseCSV(filePath: string): Promise<any[]> {
  const csvData = await fs.readFile(filePath, 'utf-8');
  return csv.parse(csvData, { columns: true });
}

// Example usage
convertToExcel('data.xml', 'output.xlsx');
