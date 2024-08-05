"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFunction = testFunction;
exports.convertToExcel = convertToExcel;
const ExcelJS = __importStar(require("exceljs"));
const fs = __importStar(require("fs/promises")); // Use the promises API for async file operations
const xml2js = __importStar(require("xml2js"));
const csv_parse_1 = require("csv-parse");
function testFunction() {
    return __awaiter(this, void 0, void 0, function* () {
        return "TS Function calling!";
    });
}
;
function convertToExcel(inputFile, extension) {
    return __awaiter(this, void 0, void 0, function* () {
        // Read the file content
        // const downloadDir = path.join(__dirname, '..', '..', '/uploads', outputFile);
        // console.log("Inputs", extension, outputFile, downloadDir);
        const fileExtension = extension;
        let data;
        try {
            switch (fileExtension) {
                case 'xml':
                    data = yield extractDataFromXML(inputFile);
                    break;
                case 'json':
                    data = yield parseJSON(inputFile);
                    break;
                case 'csv':
                    data = yield parseCSV(inputFile);
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
            const excelBuffer = yield workbook.xlsx.writeBuffer();
            // await workbook.xlsx.writeFile(outputFile);
            console.log(`Conversion complete. Excel file buffer generated`);
            return excelBuffer;
        }
        catch (error) {
            console.error('Error during conversion:', error);
        }
    });
}
function parseXML(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const xmlData = yield fs.readFile(filePath, 'utf-8');
        const parser = new xml2js.Parser({ explicitArray: false });
        return new Promise((resolve, reject) => {
            parser.parseString(xmlData, (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(Array.isArray(result) ? result : [result]);
            });
        });
    });
}
function extractDataFromXML(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const result = yield parseXML(filePath);
        // The result is an array with a single object containing the Workbook
        let workbook = (_a = result[0]) === null || _a === void 0 ? void 0 : _a.Workbook;
        if (!workbook || !workbook.Worksheet) {
            throw new Error('Invalid XML structure: missing Workbook or Worksheet');
        }
        // Handle case where there might be multiple worksheets
        let worksheet = workbook.Worksheet;
        console.log("Result worksheet data", worksheet);
        // Check if Table and Row exist
        // let rows = worksheet.Table?.Row || [];
        const table = (_c = (_b = worksheet.data) === null || _b === void 0 ? void 0 : _b.ss) === null || _c === void 0 ? void 0 : _c.Table; // Use optional chaining
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
    });
}
function parseJSON(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const jsonData = yield fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(jsonData);
        return Array.isArray(parsed) ? parsed : [parsed];
    });
}
function parseCSV(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const csvData = yield fs.readFile(filePath, 'utf-8');
        return new Promise((resolve, reject) => {
            (0, csv_parse_1.parse)(csvData, {
                columns: true,
                delimiter: ',', // Ensure the delimiter matches your CSV format
                skip_empty_lines: true,
                trim: true, // Trim whitespace around values
                relax_column_count: true // Allow rows with varying column counts
            }, (err, records) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(records);
                }
            });
        });
    });
}
