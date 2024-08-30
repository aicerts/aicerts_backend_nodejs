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
};

const FILE_TYPE_XML = 'xml';
const FILE_TYPE_JSON = 'json';
const FILE_TYPE_CSV = 'csv';
const WORKSHEET_NAME = 'Batch';

export async function convertToExcel(inputFile: string, extension: string, outputFile: string) {
  // Read the file content
  console.log("Inputs", extension, outputFile);
  const fileExtension = extension;
  let data: any[];
  try {
    switch (fileExtension) {
      case FILE_TYPE_XML:
        data = await parseXML(inputFile);
        break;
      case FILE_TYPE_JSON:
        data = await parseJSON(inputFile);
        break;
      case FILE_TYPE_CSV:
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
    const excelFileBuffer = await convertToExcelFile(data);

    return excelFileBuffer;

  } catch (error) {
    console.error('Error during conversion:', error);
  }
}

async function parseXML(filePath: string): Promise<any[]> {
  try {
    const xmlData = await fs.readFile(filePath, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false });
    console.log("The result is here", parser);
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
    console.error('Error parsing XML in parseXML:', error);
    throw error;
  }
};

async function parseJSON(filePath: string): Promise<any[]> {
  try {
    const jsonData = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(jsonData);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error('Error parsing JSON in parseJSON:', error);
    throw error;
  }
}

async function parseCSV(filePath: string): Promise<any[]> {
  try {
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
  } catch (error) {
    console.error('Error parsing CSV in parseCSV:', error);
    throw error;
  }
};


async function convertToExcelFile(data: string[]) {

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(WORKSHEET_NAME);

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
    if(!excelBuffer){
      console.error('Error during conversion in write excel Buffer');
    }
    return excelBuffer;

  } catch (error) {
    console.error('Error during conversion in convertToExcel:', error);
    return null;
  }
};