const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AdminSchema = new Schema({
    name: String,
    email: String,
    password: String,
    status: Boolean
});

const UserSchema = new Schema({
    name: String,
    organization: String,
    email: String,
    password: String,
    id: String,
    approved: Boolean
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