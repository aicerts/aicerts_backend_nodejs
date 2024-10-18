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
exports.convertToExcel = convertToExcel;
const ExcelJS = __importStar(require("exceljs"));
const fs = __importStar(require("fs/promises")); // Use the promises API for async file operations
const xml2js = __importStar(require("xml2js"));
const csv_parse_1 = require("csv-parse");
;
const FILE_TYPE_XML = 'xml';
const FILE_TYPE_JSON = 'json';
const FILE_TYPE_CSV = 'csv';
const WORKSHEET_NAME = 'Batch';
function convertToExcel(inputFile, extension, outputFile) {
    return __awaiter(this, void 0, void 0, function* () {
        // Read the file content
        console.log("Inputs", extension, outputFile);
        const fileExtension = extension;
        let data;
        try {
            switch (fileExtension) {
                case FILE_TYPE_XML:
                    data = yield parseXML(inputFile);
                    break;
                case FILE_TYPE_JSON:
                    data = yield parseJSON(inputFile);
                    break;
                case FILE_TYPE_CSV:
                    data = yield parseCSV(inputFile);
                    break;
                default:
                    throw new Error('Unsupported file format');
            }
            // console.log("the data", data);
            if (!data || !data.length) {
                console.error('No data to convert');
                return null;
            }
            const excelFileBuffer = yield convertToExcelFile(data);
            return excelFileBuffer;
        }
        catch (error) {
            console.error('Error during conversion:', error);
        }
    });
}
function parseXML(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const xmlData = yield fs.readFile(filePath, 'utf-8');
            const parser = new xml2js.Parser({ explicitArray: false });
            // console.log("The result is here", parser);
            const result = yield new Promise((resolve, reject) => {
                parser.parseString(xmlData, (err, parsedResult) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        const records = parsedResult.root.record;
                        resolve(Array.isArray(records) ? records : [records]);
                    }
                });
            });
            return result;
        }
        catch (error) {
            console.error('Error parsing XML in parseXML:', error);
            throw error;
        }
    });
}
;
function parseJSON(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const jsonData = yield fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(jsonData);
            return Array.isArray(parsed) ? parsed : [parsed];
        }
        catch (error) {
            console.error('Error parsing JSON in parseJSON:', error);
            throw error;
        }
    });
}
function parseCSV(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
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
        }
        catch (error) {
            console.error('Error parsing CSV in parseCSV:', error);
            throw error;
        }
    });
}
;
function convertToExcelFile(data) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const excelBuffer = yield workbook.xlsx.writeBuffer();
            // await workbook.xlsx.writeFile(outputFile);
            if (!excelBuffer) {
                console.error('Error during conversion in write excel Buffer');
            }
            return excelBuffer;
        }
        catch (error) {
            console.error('Error during conversion in convertToExcel:', error);
            return null;
        }
    });
}
;
