// Load environment variables from a .env file into process.env
require('dotenv').config();
const cron = require('node-cron');

// Import the mongoose library for MongoDB interaction
const mongoose = require("mongoose");

// Import the Blacklist model from the schema defined in "./schema"
const { User, Blacklist } = require("./schema");

// Parse environment variables for days to be deleted
const schedule_days = parseInt(process.env.SCHEDULE_DAYS);

// Connect to MongoDB using the MONGODB_URI environment variable
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true, // Use the new URL parser
    useUnifiedTopology: true, // Use the new Server Discover and Monitoring engine
  })
  .then(() => {
    // Schedule the task to run every day at midnight
    cron.schedule('0 0 * * *', deleteRejectedRecords);
    console.log("DB Connected & Scheduler initialised"); // Log a message when the connection is successful
  })
  .catch((err) => console.log(err)); // Log an error if the connection fails

async function deleteRejectedRecords() {
     // Calculate the date scheduled days ago
     const scheduledDaysAgo = new Date();
     scheduledDaysAgo.setDate(scheduledDaysAgo.getDate() - schedule_days);

     try {
        // Find records with rejectedDate older than scheduledDaysAgo
        const usersToDelete = await User.find({
            rejectedDate: { $lte: scheduledDaysAgo },
            rejectedDate: { $ne: null } // Exclude documents where rejectedDate is null
        });

        for (const user of usersToDelete) {
            const newBlacklist = new Blacklist({
                issuerId: user.id, 
                email: user.email,
                terminated: true,
            });

            await newBlacklist.save();

            // Delete the user
            await user.remove();

            console.log(`Deleted user with rejectedDate older than 20 days: ${user}`);
        }

    } catch (error) {
        console.error('Error deleting old records:', error);
    }
}