import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises'; // Use the promises API for async file operations
import * as xml2js from 'xml2js';
import { parse } from 'csv-parse';

export async function testFunction() {
  return "TS Function calling!";
};

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
    console.log("the data", data);
    if (!data) {
      return null;
    }
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Batch');

    if (extension == 'xml') {
      // Access the Workbook and its Worksheet
      let workbookData = data[0].Workbook;
      let worksheetData = workbookData.Worksheet;
      // console.log("The worksheet", worksheetData);
      // Extract rows from Worksheet
      // You might need to adjust this based on the actual XML structure
      let { rows, columns } = await processWorksheet(worksheetData);
      console.log("The rows", rows, columns);
      if (!rows || !columns) {
        return null;
      }
    }

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

interface Worksheet {
  $: {
    ss: {
      Name: string;
    };
  };
  'ss:Names': string;
  'ss:Table': {
    $: {
      ss: {
        DefaultRowHeight: string;
        DefaultColumnWidth: string;
        ExpandedRowCount: string;
        ExpandedColumnCount: string;
      };
    };
    Column: Array<{ $: { ss: { Index: string; Width: string; }; }; }>;
    Row: Array<{ $: { ss: { Index: string; }; }; Cell: Array<{ $: { ss: { StyleID: string; }; }; Data: { $: { Type: string; }; }; }>; }>;
    // ... other properties
  };
  WorksheetOptions: {
    $: { xmlns: string; };
    PageSetup: { Header: any; Footer: any; PageMargins: any; };
    Print: { ValidPrinterInfo: string; PaperSizeIndex: string; HorizontalResolution: string; VerticalResolution: string; };
    Panes: { Pane: any; };
  };
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
};

async function processWorksheet(worksheet: Worksheet) {
  const columns = (worksheet['ss:Table'].Column || []).map(col => ({
    index: col?.$.ss?.Index || '',
    width: col?.$.ss?.Width || ''
  }));

  const rows = (worksheet['ss:Table'].Row || []).map(row => ({
    index: row?.$.ss?.Index || '',
    cells: (row.Cell || []).map(cell => ({
      styleId: cell?.$.ss?.StyleID || '',
      data: cell?.Data?.$.Type || ''
    }))
  }));

  // const columns = worksheet['ss:Table'].Column || [];
  // const rows = worksheet['ss:Table'].Row || [];

  return { rows, columns };
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



