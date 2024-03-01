// Load environment variables from a .env file into process.env
require('dotenv').config();
const cron = require('node-cron');

// Import the mongoose library for MongoDB interaction
const mongoose = require("mongoose");

const utils = require('./utils.js');

// Import the issuer model from the schema defined in "./schema"
const { User } = require("./schema");

// Parse environment variables for days to be deleted
const schedule_days = parseInt(process.env.SCHEDULE_DAYS);

// Connect to MongoDB using the MONGODB_URI environment variable
mongoose
  .connect(utils.MONGODB_URI)
  .then(() => {
    // Schedule the task to run every day at midnight
    cron.schedule('0 0 * * *', deleteRejectedRecords);
    console.log("DB Connected & Scheduler initialised"); // Log a message when the connection is successful
  })
  .catch((err) => console.log(err)); // Log an error if the connection fails

const deleteRejectedRecords = async() => {

  try {
     // Calculate the date scheduled days ago
     const scheduledDaysAgo = new Date();
     scheduledDaysAgo.setDate(scheduledDaysAgo.getDate() - schedule_days);

     const thresholdDate = new Date(scheduledDaysAgo);

        // Find records with rejectedDate older than scheduledDaysAgo
        const usersToDelete = await User.find({
          //  $and : [{ rejectedDate: { $lt: thresholdDate }, approved: {$ne: true}}]
           rejectedDate: { $lt: thresholdDate }
         });

            // Delete the users
            for (const user of usersToDelete) {
              // Ensure that user is a mongoose model instance
              if (user instanceof mongoose.Model) {
                await User.findByIdAndDelete(user._id);
                console.log(`Deleted user with rejectedDate older than ${schedule_days} days: ${user}`);
              } else {
                console.log(`Skipping user deletion. Not a valid Mongoose model instance: ${user}`);
              }
            }
    } catch (error) {
        console.error('Error deleting old records:', error);
    }
};

