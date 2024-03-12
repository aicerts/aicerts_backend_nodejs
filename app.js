// Load environment variables from .env file
require('dotenv').config();

// Connect to the database
// require('./config/db');

// Initialize scheduler
require('./src/config/scheduler');

// Import required modules
const express = require("express");
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const bodyParser = require('body-parser');
const cors = require("cors");

// Create an Express application
const app = express();

// Define the port number
const port = process.env.PORT || 8000;

// Import routes
const tasksRoutes = require('./src/routes/routes');

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blockchain API',
      version: '1.0.0',
      description: 'API documentation for Blockchain module',
    },
  },
  apis: ['./src/routes/*.js'], // Add other paths if needed
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Configure CORS with whitelisted routes
// const corsOptions = {
//   origin: ['https://example.com'], // Add allowed origins
//   methods: ['GET', 'POST'], // Add allowed methods
// };

// Middleware
// app.use(cors(corsOptions)); // Use CORS middleware with custom options
app.use(cors());
app.use(bodyParser.json());

// Routes 
app.use('/api', tasksRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Start the server
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
