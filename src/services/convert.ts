import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises'; // Use the promises API for async file operations
import * as xml2js from 'xml2js';
import { parse } from 'csv-parse';

interface Record {
  Certs: string;
  certificationID: string;
  name: string;
  certificationName: string;
  grantDate: string;
  expirationDate: string;
}

export async function convertToExcel(inputFile: string, extension: string) {
  // Read the file content
  // console.log("Input type", extension);
  const fileExtension = extension;
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
    // console.log("the data", data);
    if (!data || !data.length) {
      console.error('No data to convert');
      return null;
    }
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
};

async function parseXML(filePath: string): Promise<any[]> {
  try {
    const xmlData = await fs.readFile(filePath, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false });

    // return new Promise((resolve, reject) => {
    //   parser.parseString(xmlData, (err, result) => {
    //     if (err) reject(err);
    //     else resolve(Array.isArray(result) ? result : [result]);
    //   });
    // });
    const result = await new Promise<Record[]>((resolve, reject) => {
      parser.parseString(xmlData, (err, parsedResult) => {
        if (err) {
          reject(err);
        } else {
          const records = parsedResult.root.record;
          resolve(Array.isArray(records) ? records : [records]);
        }
      });
    });

    return result;
  } catch (error) {
    console.error('Error parsing XML:', error);
    throw error;
  }
};

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



