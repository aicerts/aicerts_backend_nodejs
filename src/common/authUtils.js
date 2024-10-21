const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');

function generateJwtToken(response) {
  const expiresInMinutes = 60;
  const claims = {
    userType: "Admin",
  };
  try {
    const token = jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, { expiresIn: `${expiresInMinutes}m` });
    return token;
  } catch (error) {
    console.log("Error occurred while generating JWT token:", error);
    throw error;
  }
}



// Middleware to decrypt the request body
const decryptRequestBody = (req, res, next) => {
  try {
    const key = process.env.ENCRYPTION_KEY; // Use an environment variable for the encryption key
    const encryptedData = req.body.data; // Assuming the encrypted data is sent in the request body as 'encryptedData'
    if (encryptedData) {
      // Decrypt the data
      const decryptedData = decryptData(encryptedData, key);
      console.log(key, "key")
      console.log(encryptedData, "encrypt")
      console.log(decryptedData, "decrypt")


      req.body = JSON.parse(decryptedData);
    }
    // Call the next middleware or controller
    next();
  } catch (error) {
    res.status(400).json({ message: 'Failed to decrypt request data' });
  }
};

const decryptRequestParseBody = (req, res, next) => {
  try {
    const key = process.env.ENCRYPTION_KEY; // Use an environment variable for the encryption key
    const encryptedData = req.body.data; // Assuming the encrypted data is sent in the request body as 'encryptedData'
    if (encryptedData) {
      // Decrypt the data
      const decryptedData = decryptData(encryptedData, key);
      console.log(key, "key")
      console.log(encryptedData, "encrypt")
      console.log(decryptedData, "decrypt")
      req.body = decryptedData;
    }
    // Call the next middleware or controller
    next();
  } catch (error) {
    res.status(400).json({ message: 'Failed to decrypt request data' });
  }
};

// Decrypt function
const decryptData = (encryptedData, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted); // Parse the string to get the original data
};



module.exports = {
  generateJwtToken,
  decryptData,
  decryptRequestBody,
  decryptRequestParseBody
};