const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdminSchema = new Schema({
    name: String,
    email: String,
    password: String,
    status: Boolean
});

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
    approved: {
      type: Boolean,
      required: true,
    },
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
        required: true,
      },
  });

// Issues Schema
const IssuesSchema = new Schema({
    id: String,
    transactionHash: String,
    certificateHash: String,
    certificateNumber: String,
    name: String,
    course: String,
    grantDate: String,
    expirationDate: String,
    issueDate: Date
});


const Admin = mongoose.model('Admin', AdminSchema);
const User = mongoose.model('User', UserSchema);
const Issues = mongoose.model('Issues', IssuesSchema);

module.exports = {
    Admin,
    User,
    Issues
};