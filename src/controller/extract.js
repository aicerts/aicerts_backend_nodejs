const fs = require('fs');
const unzipper = require('unzipper');
const path = require("path"); // Module for working with file paths
const _fs = require("fs-extra");
const archiver = require('archiver');

const {
    cleanUploadFolder, // Function to check if the database connection is established
  } = require('../model/tasks');

const { handleExcelFile } = require('../model/handleExcel');
const { issuePdfCertificates } = require('../model/handleIssue');

/**
 * API to do Extract zip.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const extract = async(req, res) => {
    let filesList = [];
    // Initialize an empty array to store the file(s) ending with ".xlsx"
    let xlsxFiles = [];
    // Initialize an empty array to store the file(s) ending with ".pdf"
    let pdfFiles = [];

    receivedFile = req.file.path;
    const extractionPath = './uploads';

    if (!req.file || !req.file.originalname.endsWith('.zip')) {
        // File path does not match the pattern
        const errorMessage = "Must be ZIP/compressed file";
        await cleanUploadFolder(extractionPath);
        res.status(400).json({ status: "FAILED", message: errorMessage });
        return;
    }


    // Create a readable stream from the zip file
    const readStream = fs.createReadStream(receivedFile);

    // Pipe the read stream to the unzipper module for extraction
    await new Promise((resolve, reject) => {
        readStream.pipe(unzipper.Extract({ path: extractionPath }))
            .on('error', err => {
                console.error('Error extracting zip file:', err);
                reject(err);
            })
            .on('finish', () => {
                console.log('Zip file extracted successfully.');
                resolve();
            });
    });

    filesList = await fs.promises.readdir(extractionPath);

    if (filesList.length === 0) {
        await cleanUploadFolder(extractionPath);
        return res.status(400).json({ status: "FAILED", message: "Unable to find files." });
    }

    filesList.forEach(file => {
        if (file.endsWith('.xlsx')) {
            xlsxFiles.push(file);
        }
    });

    filesList.forEach(file => {
        if (file.endsWith('.pdf')) {
            pdfFiles.push(file);
        }
    });

    const excelFilePath = path.join('./uploads', xlsxFiles[0]);
    console.log(excelFilePath); // Output: ./uploads/sample.xlsx
    const excelResponse = await handleExcelFile(excelFilePath);

    const issuedCertifications = await issuePdfCertificates(pdfFiles, excelResponse);

    if(issuedCertifications == true){

        // var files = ['student_1.pdf', 'student_2.pdf', 'student_3.pdf'];
        const zipFileName = 'issued.zip';
        const resultFilePath = path.join(__dirname, '../../uploads/completed', zipFileName);
        const resultDierectory = path.join(__dirname, '../../uploads/completed');

        // Check if the directory exists, if not, create it
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Create a new zip archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level
        });

        // Create a write stream for the zip file
        const output = fs.createWriteStream(resultFilePath);

        // Listen for close event of the archive
        output.on('close', () => {
            console.log(archive.pointer() + ' total bytes');
            console.log('Zip file created successfully');
            // Send the zip file as a download
            res.download(resultFilePath, zipFileName, (err) => {
                if (err) {
                    console.error('Error downloading zip file:', err);
                }
                // Delete the zip file after download
                // fs.unlinkSync(resultFilePath);
                fs.unlink(resultFilePath, (err) => {
                    if (err) {
                        console.error('Error deleting zip file:', err);
                    }
                    console.log('Zip file deleted');
                });
            });
        });

        // Pipe the output stream to the zip archive
        archive.pipe(output);

        // Add PDF files to the zip archive
        pdfFiles.forEach(file => {
            const filePath = path.join(__dirname, '../../uploads/completed', file);
            archive.file(filePath, { name: file });
        });

        // Finalize the zip archive
        archive.finalize();

        // Always delete the excel files (if it exists)
        if (fs.existsSync(excelFilePath)) {
            fs.unlinkSync(excelFilePath);
        }

        await cleanUploadFolder();
        // await deleteFolder(resultDierectory);

        return;

    } else {
        return res.status(400).json({ status: "FAILED", message: "Certifications were not issued yet." });
    }
};

module.exports = {
    // Function to do Health Check
    extract
  };
  