require('dotenv').config();
const readXlsxFile = require('read-excel-file/node');
const path = require("path");
const Excel = require('exceljs');

const workbook = new Excel.Workbook();

const handleExcelFile = async(_path) => {

    if (!_path) {
        return { status: "FAILED", response: false, message: "Failed to provide excel file" };
    }

    // await workbook.xlsx.load(objDescExcel.buffer);
    await workbook.xlsx.readFile(_path);
    let jsonData = [];
    workbook.worksheets.forEach(function(sheet) {
        // read first row as data keys
        let firstRow = sheet.getRow(1);
        if (!firstRow.cellCount) return;
        let keys = firstRow.values;
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber == 1) return;
            let values = row.values
            let obj = {};
            for (let i = 1; i < keys.length; i ++) {
                obj[keys[i]] = values[i];
            }
            jsonData.push(obj);
        })

    });
    return jsonData;

}

module.exports = { handleExcelFile };