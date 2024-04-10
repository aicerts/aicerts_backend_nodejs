// Load environment variables from .env file
require('dotenv').config();

// Import bcrypt for hashing passwords
const bcrypt = require("bcrypt");

// Import custom authUtils module for JWT token generation
const { generateJwtToken } = require("../common/authUtils");

// Import MongoDB models
const { Admin } = require("../config/schema");

// Importing functions from a custom module
const {
  isDBConnected // Function to check if the database connection is established
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

/**
 * API call for Admin Signup.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const signup = async (req, res) => {
  // Extracting name, email, and password from the request body
  let { name, email, password } = req.body;

  // Trim whitespace from input fields
  name = name.trim();
  email = email.trim();
  password = password.trim();

  // Validation checks for input fields
  if (name == "" || email == "" || password == "") {
    // Empty input fields
    res.json({
      status: "FAILED",
      message: "Empty input fields!",
    });
  } else if (!/^[a-zA-Z ]*$/.test(name)) {
    // Invalid name format
    res.json({
      status: "FAILED",
      message: "Invalid name entered",
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    // Invalid email format
    res.json({
      status: "FAILED",
      message: "Invalid email entered",
    });
  } else if (password.length < 8) {
    // Password too short
    res.json({
      status: "FAILED",
      message: "Password is too short!",
    });
  } else {
    try {
      // Check mongoose connection
      const dbStatus = await isDBConnected();
      const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
      console.log(dbStatusMessage);

      // Checking if Admin already exists
      const existingAdmin = await Admin.findOne({ email });

      if (existingAdmin) {
        // Admin with the provided email already exists
        res.json({
          status: "FAILED",
          message: "Admin with the provided email already exists",
        });
        return; // Stop execution if user already exists
      }

      // password handling
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Save new user
      const newAdmin = new Admin({
        name,
        email,
        password: hashedPassword,
        status: false
      });

      const savedAdmin = await newAdmin.save();
      res.json({
        status: "SUCCESS",
        message: "Signup successful",
        data: savedAdmin,
      });
    } catch (error) {
      // An error occurred during signup process
      return res.status(500).json({ status: "FAILED", message: "Internal server error", details: error });
    }
  }
};

/**
 * API call for Admin Login.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const login = async (req, res) => {
  let { email, password } = req.body;

  // Check if email or password is empty
  if (email == "" || password == "") {
    res.json({
      status: "FAILED",
      message: "Empty credentials supplied",
    });
  } else {
    // Check database connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);

    // Checking if user exists 
    const adminExist = await Admin.findOne({ email });

    // Finding user by email
    Admin.find({ email })
      .then((data) => {
        if (data.length) {

          // User exists
          const hashedPassword = data[0].password;
          // Compare password hashes
          bcrypt
            .compare(password, hashedPassword)
            .then((result) => {
              if (result) {
                // Password match
                // Update admin status to true
                adminExist.status = true;
                adminExist.save();

                // Generate JWT token for authentication
                const JWTToken = generateJwtToken();

                // Respond with success message and user details
                res.status(200).json({
                  status: "SUCCESS",
                  message: "Valid User Credentials",
                  data: {
                    JWTToken: JWTToken,
                    name: data[0]?.name,
                    organization: data[0]?.organization,
                    email: data[0]?.email
                  }
                });
              } else {
                // Incorrect password
                res.json({
                  status: "FAILED",
                  message: "Invalid password entered!",
                });
              }
            })
            .catch((err) => {
              // Error occurred while comparing passwords
              res.json({
                status: "FAILED",
                message: "An error occurred while comparing passwords",
              });
            });

        } else {
          // User with provided email not found
          res.json({
            status: "FAILED",
            message: "Invalid credentials entered!",
          });
        }
      })
      .catch((err) => {
        // Error occurred during login process
        res.json({
          status: "FAILED",
          message: "An error occurred while checking for existing user",
        });
      });
  }
};

/**
 * API call for Admin Logout.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const logout = async (req, res) => {
  let { email } = req.body;
  try {
    // Check mongoose connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);

    // Checking if Admin already exists
    const existingAdmin = await Admin.findOne({ email });

    // If admin doesn't exist, or if they are not logged in, return failure response
    if (!existingAdmin) {
      return res.json({
        status: 'FAILED',
        message: 'Admin not found (or) Not Logged in!',
      });

    }

    // Save logout details by updating admin status to false
    existingAdmin.status = false;
    existingAdmin.save();

    // Respond with success message upon successful logout
    res.json({
      status: "SUCCESS",
      message: "Admin Logged out successfully"
    });

  } catch (error) {
    // Error occurred during logout process, respond with failure message
    res.json({
      status: 'FAILED',
      message: 'An error occurred during the logout!',
    });
  }
};

/**
 * API call for Reset Admin Password.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const resetPassword = async (req, res) => {
  let { email, password } = req.body;
  try {
    // Check database connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? "Database connection is Ready" : "Database connection is Not Ready";
    console.log(dbStatusMessage);

    // Find admin by email
    const admin = await Admin.findOne({ email });

    // If admin doesn't exist, return failure response
    if (!admin) {
      return res.json({
        status: 'FAILED',
        message: 'Admin not found',
      });
    }
    // Hash the new password
    const saltRounds = 10;
    bcrypt
      .hash(password, saltRounds)
      .then((hashedPassword) => {
        // Save hashed password to admin document
        admin.password = hashedPassword;
        // Save the admin document
        admin
          .save()
          .then(() => {
            // Password reset successful, respond with success message
            res.json({
              status: "SUCCESS",
              message: "Password reset successful"
            });
          })
          .catch((err) => {
            // Error occurred while saving user account, respond with failure message
            res.json({
              status: "FAILED",
              message: "An error occurred while saving user account!",
            });
          });
      })
      .catch((err) => {
        // Error occurred while hashing password, respond with failure message
        res.json({
          status: "FAILED",
          message: "An error occurred while hashing password!",
        });
      });

  } catch (error) {
    // Error occurred during password reset process, respond with failure message
    res.json({
      status: 'FAILED',
      message: 'An error occurred during password reset process!',
    });
  }
};


module.exports = {
  // Function to handle admin signup
  signup,

  // Function to handle admin login
  login,

  // Function to handle admin logout
  logout,

  // Function to reset admin password
  resetPassword
};
