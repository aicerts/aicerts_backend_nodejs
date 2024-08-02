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
const csv = __importStar(require("csv-parse/sync")); // Use synchronous API for simplicity
function testFunction() {
    return __awaiter(this, void 0, void 0, function* () {
        return "TS Function calling!";
    });
}
;
function convertToExcel(inputFile, extension, outputFile) {
    return __awaiter(this, void 0, void 0, function* () {
        // Read the file content
        console.log("Inputs", extension, outputFile);
        const fileExtension = extension;
        let data;
        try {
            switch (fileExtension) {
                case 'xml':
                    data = yield parseXML(inputFile);
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
            let _theResponse = yield workbook.xlsx.writeFile(outputFile);
            const _excelBuffer = yield workbook.xlsx.readFile(outputFile);
            const excelBuffer = yield fs.readFile(outputFile);
            console.log("The buffer", excelBuffer, _excelBuffer);
            console.log(`Conversion complete. Excel file saved as ${outputFile}`);
            return _excelBuffer;
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
        return csv.parse(csvData, { columns: true });
    });
}
