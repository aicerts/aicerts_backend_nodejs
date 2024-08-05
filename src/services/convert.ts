import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises'; // Use the promises API for async file operations
import * as xml2js from 'xml2js';
import { parse } from 'csv-parse';

export async function testFunction() {
  return "TS Function calling!";
};

export async function convertToExcel(inputFile: string, extension: string) {
  // Read the file content
  // const downloadDir = path.join(__dirname, '..', '..', '/uploads', outputFile);
  // console.log("Inputs", extension, outputFile, downloadDir);
  const fileExtension = extension;
  let data: any[];
  try {
    switch (fileExtension) {
      case 'xml':
        data = await extractDataFromXML(inputFile);
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
    console.log("the data", data);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Batch');

    // Add column headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // Add data rows
    data.forEach(row => {
      worksheet.addRow(Object.values(row));
    });

    // Write to buffer instead of file directly
    const excelBuffer = await workbook.xlsx.writeBuffer();
    // await workbook.xlsx.writeFile(outputFile);

    console.log(`Conversion complete. Excel file buffer generated`);
    return excelBuffer;

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

async function extractDataFromXML(filePath: string) {
  const result = await parseXML(filePath);
  // The result is an array with a single object containing the Workbook
  let workbook = result[0]?.Workbook;
  if (!workbook || !workbook.Worksheet) {
    throw new Error('Invalid XML structure: missing Workbook or Worksheet');
  }
  // Handle case where there might be multiple worksheets
  let worksheet = workbook.Worksheet;

  console.log("Result worksheet data", worksheet);
  // Check if Table and Row exist
  // let rows = worksheet.Table?.Row || [];
  const table = worksheet.data?.ss?.Table; // Use optional chaining

  if (!table) {
    // Handle missing table case (e.g., return empty arrays)
    throw new Error('Invalid XML structure: missing Workbook or Worksheet');
  }

  console.log("Result data", table);
  // Convert rows to an array of arrays
  // let _data = rows.map((row: any) => 
  //   row.Cell.map((cell: any) => cell.Data._ || '') // Extract text data from each cell
  // );

  return result;
}

async function parseJSON(filePath: string): Promise<any[]> {
  const jsonData = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(jsonData);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function parseCSV(filePath: string): Promise<any[]> {
  const csvData = await fs.readFile(filePath, 'utf-8');
  return new Promise<any[]>((resolve, reject) => {
    parse(csvData, {
      columns: true,
      delimiter: ',',    // Ensure the delimiter matches your CSV format
      skip_empty_lines: true,
      trim: true,        // Trim whitespace around values
      relax_column_count: true  // Allow rows with varying column counts
    }, (err, records) => {
      if (err) {
        reject(err);
      } else {
        resolve(records);
      }
    });
  });
}



