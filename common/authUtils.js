const jwt = require('jsonwebtoken');


function generateJwtToken(response) {
    const expiresInMinutes = 60;
    const claims = {
      userType:"Admin",
      
    };
    
    const token = jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET, { expiresIn: `${expiresInMinutes}m` });
    return token;
  }
 
 
  module.exports = {
    generateJwtToken,
  };