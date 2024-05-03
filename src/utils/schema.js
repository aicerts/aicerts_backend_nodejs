const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Batch Issues Schema
const BatchIssuesSchema = new Schema({
    issuerId: { type: String, required: true },
    batchId: { type: Number, required: true },
    proofHash: [String],
    encodedProof: { type: String, required: true },
    transactionHash: { type: String, required: true },
    certificateHash: { type: String, required: true },
    certificateNumber: { type: String, required: true },
    name: { type: String, required: true },
    course: { type: String, required: true },
    grantDate: { type: String, required: true },
    expirationDate: { type: String, required: true },
    issueDate: { type: Date, default: Date.now }
});

// Define the schema for the Issues model
const IssuesSchema = new mongoose.Schema({
  issuerId: { type: String, required: true }, // ID field is of type String and is required
  transactionHash: { type: String, required: true }, // TransactionHash field is of type String and is required
  certificateHash: { type: String, required: true }, // CertificateHash field is of type String and is required
  certificateNumber: { type: String, required: true }, // CertificateNumber field is of type String and is required
  name: { type: String, required: true }, // Name field is of type String and is required
  course: { type: String, required: true }, // Course field is of type String and is required
  grantDate: { type: String, required: true }, // GrantDate field is of type String and is required
  expirationDate: { type: String, required: true }, // ExpirationDate field is of type String and is required
  certificateStatus: { type: Number, required: true, default: 1 },
  issueDate: { type: Date, default: Date.now } // issueDate field is of type Date and defaults to the current date/time
});


const Issues = mongoose.model('Issues', IssuesSchema);
const BatchIssues = mongoose.model('BatchIssues', BatchIssuesSchema);

module.exports = {
    Issues,
    BatchIssues
};