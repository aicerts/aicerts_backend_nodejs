const express = require('express');
const router = express.Router();

let extract = require("./extract");


router.use(extract);

module.exports = router