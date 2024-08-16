// Load environment variables from .env file
require('dotenv').config();
const { validationResult } = require("express-validator");
// Import required modules
const { ethers } = require("ethers"); // Ethereum JavaScript library

// Import MongoDB models
const { User, ServiceAccountQuotas } = require("../config/schema");

// Import ABI (Application Binary Interface) from the JSON file located at "../config/abi.json"
const abi = require("../config/abi.json");

// Importing functions from a custom module
const {
  isDBConnected, // Function to check if the database connection is established
  sendEmail, // Function to send an email on approved
  rejectEmail, // Function to send an email on rejected
  generateAccount
} = require('../model/tasks'); // Importing functions from the '../model/tasks' module

// Retrieve contract address from environment variable
const rpcProvider = new ethers.JsonRpcProvider(process.env.RPC_ENDPOINT);
const contractAddress = process.env.CONTRACT_ADDRESS;

// Define an array of providers to use as fallbacks
const providers = [
  new ethers.AlchemyProvider(process.env.RPC_NETWORK, process.env.ALCHEMY_API_KEY),
  new ethers.InfuraProvider(process.env.RPC_NETWORK, process.env.INFURA_API_KEY)
  // Add more providers as needed
];

// Create a new FallbackProvider instance
// const fallbackProvider = new ethers.FallbackProvider([rpcProvider]);
const fallbackProvider = new ethers.FallbackProvider(providers);

// Create a new ethers signer instance using the private key from environment variable and the provider(Fallback)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, fallbackProvider);

// Create a new ethers contract instance with a signing capability (using the contract Address, ABI and signer)
const newContract = new ethers.Contract(contractAddress, abi, signer);

var messageCode = require("../common/codes");

const statusCount = parseInt(process.env.STATUS_COUNT) || 4;
const maxCreditLimit = process.env.LIMIT_THRESHOLD || 100;

var linkUrl = process.env.NETWORK || "polygon";
/**
 * Define a route that takes a hash parameter.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const polygonLink = async (req, res) => {
  res.json({ linkUrl });
};

/**
 * API to approve or reject Issuer status.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const validateIssuer = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  let validationStatus = req.body.status;
  let email = req.body.email;

  // Find user by email
  const userExist = await User.findOne({ email });

  if (!email || !userExist || (validationStatus != 1 && validationStatus != 2)) {
    var defaultMessage = messageCode.msgInvalidInput;

    if ((validationStatus != 1 && validationStatus != 2)) {
      var defaultMessage = messageCode.msgProvideValidStatus;
    } else if (!userExist) {
      var defaultMessage = messageCode.msgUserNotFound;
    }
    return res.status(400).json({ status: "FAILED", message: defaultMessage });
  }

  try {
    // Check mongo DB connection
    const dbStatus = await isDBConnected();
    const dbStatusMessage = (dbStatus == true) ? messageCode.msgDbReady : messageCode.msgDbNotReady;
    console.log(dbStatusMessage);
    try {
      const roleStatus = await newContract.hasRole(process.env.ISSUER_ROLE, userExist.issuerId);

      if (roleStatus === false && validationStatus == 2) {
        if (userExist.status != 2) {
          // Save Issuer rejected details
          userExist.approved = false;
          userExist.status = 2;
          userExist.rejectedDate = Date.now();
          await userExist.save();

          // If user is not rejected yet, send email and update user's rejected status
          var mailStatus = await rejectEmail(userExist.name, email);
          var mailresponse = (mailStatus === true) ? "sent" : "NA";

          // Respond with success message indicating user rejected
          res.json({
            status: "SUCCESS",
            email: mailresponse,
            message: messageCode.msgIssuerRejectSuccess,
            details: userExist
          });
        } else {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgRejecetedAlready });
        }
      }

      else if (validationStatus == 1 && roleStatus === false) {

        if ((userExist.status == validationStatus) && (roleStatus == true)) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgExistedVerified });
        }

        var grantedStatus;
        if (roleStatus === false) {

          var { txHash, polygonLink } = await grantOrRevokeRoleWithRetry("grant", process.env.ISSUER_ROLE, userExist.issuerId);
          if (!polygonLink || !txHash) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedToGrantRoleRetry });
          }
          grantedStatus = "SUCCESS";

          // Save verification details
          userExist.approved = true;
          userExist.status = 1;
          userExist.rejectedDate = null;
          await userExist.save();
          // If user is not approved yet, send email and update user's approved status
          var mailStatus = await sendEmail(userExist.name, email);
          var mailresponse = (mailStatus === true) ? "sent" : "NA";
          var _details = grantedStatus == "SUCCESS" ? _details = polygonLink : _details = "";
          // Respond with success message indicating user approval
          res.json({
            status: "SUCCESS",
            email: mailresponse,
            grant: grantedStatus,
            message: messageCode.msgIssuerApproveSuccess,
            details: _details
          });
        }

      } else if (validationStatus == 2 && roleStatus === true) {

        if ((userExist.status == validationStatus) && (roleStatus == false)) {
          res.status(400).json({ status: "FAILED", message: messageCode.msgExistRejectIssuer });
        }

        var revokedStatus;
        if (roleStatus === true) {

          var { txHash, polygonLink } = await grantOrRevokeRoleWithRetry("revoke", process.env.ISSUER_ROLE, userExist.issuerId);
          if (!polygonLink || !txHash) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedToRevokeRoleRetry });
          }
          revokedStatus = "SUCCESS";

          // Save Issuer rejected details
          userExist.approved = false;
          userExist.status = 2;
          userExist.rejectedDate = Date.now();
          await userExist.save();

          try {
            // If user is not rejected yet, send email and update user's rejected status
            var mailStatus = await rejectEmail(userExist.name, email);
            var mailresponse = (mailStatus === true) ? "sent" : "NA";
            var _details = revokedStatus == "SUCCESS" ? _details = polygonLink : _details = "";
          } catch (error) {
            return res.status(400).json({ status: "FAILED", message: mailresponse, details: error });
          }
          // Respond with success message indicating user rejected
          res.json({
            status: "SUCCESS",
            email: mailresponse,
            revoke: revokedStatus,
            message: messageCode.msgIssuerRejectSuccess,
            details: _details
          });
        }
      } else if (validationStatus == 1 && roleStatus === true) {
        res.json({
          status: "SUCCESS",
          message: messageCode.msgIssuerApproveSuccess
        });
      }
    } catch (error) {
      // Error occurred during user approval process, respond with failure message
      return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
    }
  } catch (error) {
    // Error occurred during user approval process, respond with failure message
    res.json({
      status: 'FAILED',
      message: messageCode.msgIssueInValidation,
      details: error
    });
  }
};

/**
 * API to Grant Issuer/Owner Role to an Address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const addTrustedOwner = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  // const { newOwnerAddress } = req.body;
  try {
    // Extract new wallet address from request body
    const assignRole = 1;
    const newAddress = req.body.address;
    // Validate Ethereum address format
    if (!ethers.isAddress(newAddress)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
    }

    if (assignRole == 0 || assignRole == 1) {

      const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

      try {
        // Blockchain processing.
        const response = await newContract.hasRole(assigningRole, newAddress);

        if (response === true) {
          // Simulation failed, send failure response
          return res.status(400).json({ status: "FAILED", message: messageCode.msgAddressExistBlockchain });
        }

        var { txHash, polygonLink } = await grantOrRevokeRoleWithRetry("grant", assigningRole, newAddress);

        if (!polygonLink || !txHash) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedToGrantRoleRetry });
        }

        const messageInfo = (assignRole == 0) ? messageCode.msgAdminGrant : messageCode.msgIssuerRoleGrant;

        // Prepare success response
        const responseMessage = {
          status: "SUCCESS",
          message: messageInfo,
          details: `https://${process.env.NETWORK}/tx/${txHash}`
        };

        // Send success response
        res.status(200).json(responseMessage);
      } catch (error) {
        // Error occurred during user approval process, respond with failure message
        return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    // Internal server error occurred, send failure response
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API to Revoke Issuer/Owner Role from the Address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const removeTrustedOwner = async (req, res) => {
  var validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  // const { newOwnerAddress } = req.body;
  try {
    // Extract new wallet address from request body
    const assignRole = 1;
    const newAddress = req.body.address;

    // Check if the target address is a valid Ethereum address
    if (!ethers.isAddress(newAddress)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
    }

    if (assignRole == 0 || assignRole == 1) {

      const assigningRole = (assignRole == 0) ? process.env.ADMIN_ROLE : process.env.ISSUER_ROLE;

      try {
        // Blockchain processing.
        const response = await newContract.hasRole(assigningRole, newAddress);

        if (response === false) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgAddressNotExistBlockchain });
        }

        var { txHash, polygonLink } = await grantOrRevokeRoleWithRetry("revoke", assigningRole, newAddress);
        if (!polygonLink || !txHash) {
          return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedToRevokeRoleRetry });
        }

        const messageInfo = (assignRole == 0) ? messageCode.msgAdminRevoke : messageCode.msgIssuerRoleRevoke;

        // Prepare success response
        const responseMessage = {
          status: "SUCCESS",
          message: messageInfo,
          details: `https://${process.env.NETWORK}/tx/${txHash}`
        };
        // Send success response
        res.status(200).json(responseMessage);
      } catch (error) {
        // Error occurred during user approval process, respond with failure message
        return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
      }
    }
  } catch (error) {
    // Internal server error occurred, send failure response
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API to Check the balance of an Ethereum account address.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const checkBalance = async (req, res) => {

  try {
    // Extract the target address from the query parameter
    const targetAddress = req.query.address;

    // Check if the target address is a valid Ethereum address
    if (!ethers.isAddress(targetAddress)) {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
    }

    // Get the balance of the target address in Wei
    const balanceWei = await fallbackProvider.getBalance(targetAddress);

    // Convert balance from Wei to Ether
    const balanceEther = ethers.formatEther(balanceWei);

    // Convert balanceEther to fixed number of decimals (e.g., 2 decimals)
    const fixedDecimals = parseFloat(balanceEther).toFixed(3);

    // Prepare balance response
    const balanceResponse = {
      message: messageCode.msgBalanceCheck,
      balance: fixedDecimals,
    };

    // Respond with the balance information
    res.status(200).json(balanceResponse);
  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API to update IssuerId (Ethereum account address) and validate upon login.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */

const createAndValidateIssuerIdUponLogin = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }

  const email = req.body.email;
  let attempts = 0;
  let getNewId = null;
  // Define a mapping object for credits to service names
  const creditToServiceName = {
    1: 'issue',
    2: 'renew',
    3: 'revoke',
    4: 'reactivate'
  };
  const serviceLimit = process.env.SERVICE_LIMIT || 10;
  var insertPromises = [];
  var creditsExist;
  const todayDate = new Date();

  try {
    var dbStatus = isDBConnected();

    if (dbStatus) {
      // Find user by email
      const userExist = await User.findOne({ email });
      if (!userExist) {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgUserNotFound });
      }

      var values = Object.values(userExist);
      const lastElement = values[values.length - 1];

      var getIssuerId = 0;
      if (userExist.issuerId == undefined) {
        // Loop through each property in the data object
        for (const value of Object.values(lastElement)) {
          if (ethers.isAddress(value)) {
            getIssuerId = value;
          }
        }

        if (getIssuerId != 0) {
          // Save verification details
          userExist.issuerId = getIssuerId;
          userExist['approved'] = false;
          userExist.status = 1;
          userExist.rejectedDate = null;
          if (userExist['certificatesRenewed'] == undefined) {
            userExist.certificatesRenewed = 0;
          }
          if (userExist['credits'] == undefined) {
            userExist.credits = 0;
          }
          await userExist.save();

          try {
            // Blockchain processing.
            let response = await newContract.hasRole(process.env.ISSUER_ROLE, getIssuerId);
            if (!response) {
              var { txHash, polygonLink } = await grantOrRevokeRoleWithRetry("grant", process.env.ISSUER_ROLE, getIssuerId);
              if (!polygonLink || !txHash) {
                return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedToGrantRoleRetry });
              }
            }
          } catch (error) {
            return res.status(500).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
          }

          creditsExist = await ServiceAccountQuotas.find({ issuerId: getIssuerId });
          if (!creditsExist || creditsExist.length < statusCount) {
            for (let count = 1; count < 5; count++) {
              let serviceName = creditToServiceName[count];
              let serveiceExist = await ServiceAccountQuotas.findOne({
                issuerId: getIssuerId,
                serviceId: serviceName
              });

              if (!serveiceExist) {
                // Initialise credits
                let newServiceAccountQuota = new ServiceAccountQuotas({
                  issuerId: getIssuerId,
                  serviceId: serviceName,
                  limit: serviceLimit,
                  status: true,
                  createdAt: todayDate,
                  updatedAt: todayDate,
                  resetAt: todayDate
                });

                // await newServiceAccountQuota.save();
                insertPromises.push(newServiceAccountQuota.save());
              }
            }
            // Wait for all insert promises to resolve
            await Promise.all(insertPromises);
          }

          return res.status(200).json({ status: "SUCCESS", message: messageCode.msgIssuerIdExist });
        }

        try {

          while (attempts < 3 && !getNewId) {
            getNewId = await generateAccount();
            attempts++;
          }

          if (!getNewId) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidEthereum });
          }

          var { txHash, polygonLink } = await grantOrRevokeRoleWithRetry("grant", process.env.ISSUER_ROLE, getNewId);
          if (!polygonLink || !txHash) {
            return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedToGrantRoleRetry });
          }

          // Save verification details
          userExist.issuerId = getNewId;
          userExist.approved = true;
          userExist.status = 1;
          userExist.rejectedDate = null;
          if (userExist['certificatesRenewed'] == undefined) {
            userExist.certificatesRenewed = 0;
          }
          if (userExist['credits'] == undefined) {
            userExist.credits = 0;
          }
          await userExist.save();

          for (let count = 1; count < 5; count++) {
            let serviceName = creditToServiceName[count];
            // Initialise credits
            let newServiceAccountQuota = new ServiceAccountQuotas({
              issuerId: getNewId,
              serviceId: serviceName,
              limit: serviceLimit,
              status: true,
              createdAt: todayDate,
              updatedAt: todayDate,
              resetAt: todayDate
            });

            // await newServiceAccountQuota.save();
            insertPromises.push(newServiceAccountQuota.save());
          }
          // Wait for all insert promises to resolve
          await Promise.all(insertPromises);

          return res.status(200).json({ status: "SUCCESS", message: messageCode.msgIssuerApproveSuccess, details: polygonLink });

        } catch (error) {
          return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
        }
      } else {

        if (userExist['certificatesRenewed'] == undefined) {
          userExist.certificatesRenewed = 0;
        }
        if (userExist['credits'] == undefined) {
          userExist.credits = 0;
        }
        userExist.approved = true;
        userExist.status = 1;
        userExist.rejectedDate = null;
        await userExist.save();

        try {
          // Blockchain processing.
          var response = await newContract.hasRole(process.env.ISSUER_ROLE, userExist.issuerId);
          if (!response) {
            var { txHash, polygonLink } = await grantOrRevokeRoleWithRetry("grant", process.env.ISSUER_ROLE, userExist.issuerId);
            if (!polygonLink || !txHash) {
              return res.status(400).json({ status: "FAILED", message: messageCode.msgFailedToGrantRoleRetry });
            }
          }
        } catch (error) {
          return res.status(500).json({ status: "FAILED", message: messageCode.msgFailedAtBlockchain, details: error });
        }

        creditsExist = await ServiceAccountQuotas.find({ issuerId: userExist.issuerId });
          if (!creditsExist || creditsExist.length < statusCount) {
            for (let count = 1; count < 5; count++) {
              let serviceName = creditToServiceName[count];
              let serveiceExist = await ServiceAccountQuotas.findOne({
                issuerId: userExist.issuerId,
                serviceId: serviceName
              });

              if (!serveiceExist) {
                // Initialise credits
                let newServiceAccountQuota = new ServiceAccountQuotas({
                  issuerId: userExist.issuerId,
                  serviceId: serviceName,
                  limit: serviceLimit,
                  status: true,
                  createdAt: todayDate,
                  updatedAt: todayDate,
                  resetAt: todayDate
                });

                // await newServiceAccountQuota.save();
                insertPromises.push(newServiceAccountQuota.save());
              }
            }
            // Wait for all insert promises to resolve
            await Promise.all(insertPromises);
          }

        return res.status(200).json({ status: "SUCCESS", message: messageCode.msgIssuerIdExist });
      }
    } else {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgDbNotReady });
    }
  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
};

/**
 * API to allocate / update credits to an issuer based on the email and Service ID.
 *
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */

const allocateCredits = async (req, res) => {
  let validResult = validationResult(req);
  if (!validResult.isEmpty()) {
    return res.status(422).json({ status: "FAILED", message: messageCode.msgEnterInvalid, details: validResult.array() });
  }
  const email = req.body.email;
  const activeStatus = req.body.status;
  let _service = req.body.service;
  let _credits = req.body.credits;
  // Define a mapping object for credits to service names
  const creditToServiceName = {
    1: 'issue',
    2: 'renew',
    3: 'revoke',
    4: 'reactivate'
  };

  var service = parseInt(_service);
  var credits = parseInt(_credits);

  if(credits > maxCreditLimit){
    return res.status(400).json({ status: "FAILED", message: messageCode.msgValidCredits });
  }

  // Determine serviceName based on service code input
  const serviceName = creditToServiceName[service] || null;

  if (!serviceName) {
    return res.status(400).json({ status: "FAILED", message: messageCode.msgProvideValidService });
  }

  try {
    var dbStatus = isDBConnected();
    if (dbStatus) {
     
      // Check if user with provided email exists
      const issuerExist = await User.findOne({ email: email }).select('-password');

      if (!issuerExist || !issuerExist.issuerId) {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgInvalidIssuer, details: email });
      }

      var fetchServiceQuota = await ServiceAccountQuotas.findOne({
        issuerId: issuerExist.issuerId,
        serviceId: serviceName
      });

      if (!fetchServiceQuota) {
        return res.status(400).json({ status: "FAILED", message: messageCode.msgFetchQuotaFailed });
      }

      if(fetchServiceQuota.status == false && credits > 0){
        return res.status(400).json({ status: "FAILED", message: `${messageCode.msgNoCreditsForService} : ${creditToServiceName[service]}` });
      }

      const newLimit = fetchServiceQuota.limit > 0 ? fetchServiceQuota.limit + credits : credits;
      fetchServiceQuota.limit = newLimit;
      fetchServiceQuota.status = activeStatus;
      fetchServiceQuota.updatedAt = new Date();
      await fetchServiceQuota.save();

      let updatedDetails = {
        newLimit: newLimit,
        serviceType: serviceName,
        status: activeStatus == true ? 'Active' : 'Inactive'
      }

      let messageContent = activeStatus == true ? messageCode.msgCreditsUpdatedSuccess : `${messageCode.msgIssuerQuotaStatus}:${serviceName}`;

      return res.status(200).json({ status: "SUCCESS", message: messageContent, details: updatedDetails });
      // const userExist
    } else {
      return res.status(400).json({ status: "FAILED", message: messageCode.msgDbNotReady });
    }

  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ status: "FAILED", message: messageCode.msgInternalError, details: error });
  }
}

// Blockchain call for Grant / Revoke Issuer role
const grantOrRevokeRoleWithRetry = async (roleStatus, role, id, retryCount = 3) => {
  try {
    // Issue Single Certifications on Blockchain
    if (roleStatus == "grant") {
      var tx = await newContract.grantRole(
        role,
        id
      );
    } else if (roleStatus == "revoke") {
      var tx = await newContract.revokeRole(
        role,
        id
      );
    } else {
      return null;
    }
    var txHash = tx.hash;

    var polygonLink = `https://${process.env.NETWORK}/tx/${txHash}`;

    return { txHash, polygonLink };

  } catch (error) {
    if (retryCount > 0 && error.code === 'ETIMEDOUT') {
      console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
      // Retry after a delay (e.g., 2 seconds)
      await holdExecution(2000);
      return grantOrRevokeRoleWithRetry(roleStatus, role, id, retryCount - 1);
    } else if (error.code === 'NONCE_EXPIRED') {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return null;
    } else if (error.reason) {
      // Extract and handle the error reason
      // console.log("Error reason:", error.reason);
      return null;
    } else {
      // If there's no specific reason provided, handle the error generally
      // console.error(messageCode.msgFailedOpsAtBlockchain, error);
      return null;
    }
  }
};

module.exports = {
  // Function to generate a Polygon link for a certificate
  polygonLink,

  // Function to Approve or Reject the Issuer
  validateIssuer,

  createAndValidateIssuerIdUponLogin,

  // Function to allocate Credits to Issuer
  allocateCredits,

  // Function to grant role to an address
  addTrustedOwner,

  // Function to revoke role from the address
  removeTrustedOwner,

  // Function to check the balance of an Ethereum address
  checkBalance
};
