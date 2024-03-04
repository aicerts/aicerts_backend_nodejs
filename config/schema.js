const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for the Admin model
const AdminSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name field is of type String and is required
  email: { type: String, required: true }, // Email field is of type String and is required
  password: { type: String, required: true }, // Password field is of type String and is required
  status: { type: Boolean, required: true } // Status field is of type Boolean and is required
});

// Define the schema for the User/Isseur model
const UserSchema = new Schema({
    name: {
      type: String,
      required: true,
    },
    organization: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    approved: Boolean,
    address: String,
    country: String,
    organizationType: String,
    city: String,
    zip: String,
    industrySector: String,
    state: String,
    websiteLink: String,
    phoneNumber: String,
    designation: String,
    username: {
        type: String,
        unique: true,
      }
  });

// Define the schema for the Issues model
const IssuesSchema = new mongoose.Schema({
  id: { type: String, required: true }, // ID field is of type String and is required
  transactionHash: { type: String, required: true }, // TransactionHash field is of type String and is required
  certificateHash: { type: String, required: true }, // CertificateHash field is of type String and is required
  certificateNumber: { type: String, required: true }, // CertificateNumber field is of type String and is required
  name: { type: String, required: true }, // Name field is of type String and is required
  course: { type: String, required: true }, // Course field is of type String and is required
  grantDate: { type: String, required: true }, // GrantDate field is of type String and is required
  expirationDate: { type: String, required: true }, // ExpirationDate field is of type String and is required
  issueDate: { type: Date, default: Date.now } // IssueDate field is of type Date and defaults to the current date/time
});


const Admin = mongoose.model('Admin', AdminSchema);
const User = mongoose.model('User', UserSchema);
const Issues = mongoose.model('Issues', IssuesSchema);

module.exports = {
    Admin,
    User,
    Issues
};