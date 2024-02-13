const jwt = require("jsonwebtoken");


module.exports.ensureAuthenticated = (req, res, next) => {
    const authorizationHeader = req.headers["authorization"];

    if (!authorizationHeader) {
        console.log("No authorization header found");
        return res.status(401).send({ status: false, err: "Unauthorized access. No token provided." });
    }

    const [bearer, token] = authorizationHeader.split(' ');

    if (!token || bearer.toLowerCase() !== 'bearer') {
        console.log("Invalid authorization header format");
        return res.status(401).send({ status: false, err: "Unauthorized access. Invalid token format." });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        
        if (err) {
            console.log("JWT token error: ", err);
            return res.status(401).send({ status: false, err: "Unauthorized access. Invalid token." });
        }
        next();
    });
};
