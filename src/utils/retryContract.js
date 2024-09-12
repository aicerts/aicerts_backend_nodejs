// Load environment variables from .env file
require('dotenv').config();
const { ethers } = require("ethers"); // Ethereum JavaScript library

const messageCode = require("../common/codes");

// Retrieve contract address from environment variable
const contractAddress = process.env.CONTRACT_ADDRESS;

// Define an array of providers to use as fallbacks
const providers = [
    new ethers.AlchemyProvider(process.env.RPC_NETWORK, process.env.ALCHEMY_API_KEY),
    new ethers.InfuraProvider(process.env.RPC_NETWORK, process.env.INFURA_API_KEY)
    // new ethers.ChainstackProvider(process.env.RPC_NETWORK, process.env.CHAIN_KEY),
    // new ethers.JsonRpcProvider(process.env.CHAIN_RPC)
    // Add more providers as needed
  ];
  
  // Create a new FallbackProvider instance
  const fallbackProvider = new ethers.FallbackProvider(providers);

// Importing functions from a custom module
const {
    connectToPolygon,
    holdExecution,
  } = require('../model/tasks'); // Importing functions from the '../model/tasks' module

  
const getContractFunctionWithRetry = async (certificateNumber, certificateHash, expirationEpoch, retryCount = 3, gasPrice = null) => {
    const newContract = await connectToPolygon();
    if (!newContract) {
      return ({ code: 400, status: "FAILED", message: messageCode.msgRpcFailed });
    }
    console.log("Inputs", certificateNumber, certificateHash, expirationEpoch);
    try {
      // Fetch the current gas price if not already provided
      if (!gasPrice) {
        const feeData = await fallbackProvider.getFeeData();
        gasPrice = feeData.gasPrice.toString(); // Convert to string if needed
      }
  
      console.log("Gas Price:", gasPrice.toString());
  
      // Ensure gasPrice is a BigInt
      if (typeof gasPrice === 'string') {
        gasPrice = BigInt(gasPrice);
      } else if (!gasPrice) {
        throw new Error('Gas price is not available');
      }
  
      // Increase gas price by 5%
      const factor = 105n; // 1.05 in BigInt notation
      const divisor = 100n; // 100 in BigInt notation
      const increasedGasPrice = gasPrice * factor / divisor;
      console.log("Adjusted Gas Price:", increasedGasPrice.toString());
  
      // Issue Single Certification on Blockchain
      const tx = await newContract.issueCertificate(
        certificateNumber,
        certificateHash,
        expirationEpoch,
        {
          gasPrice : increasedGasPrice, // Pass the gas price
        }
      );
  
      const txHash = tx.hash;
  
      if (!txHash) {
        throw new Error('Transaction hash is null');
      }
      return ({ code: 200, message: txHash });
  
    } catch (error) {
      if (error.reason == 'Certificate already issued') {
        return ({ code: 200, message: "issued" });
      }
      if (error.code == 'INVALID_ARGUMENT' || error.code == 'REPLACEMENT_ERROR') {
        return ({ code: 400, message: messageCode.msgInvalidArguments, details: error.reason });
      }
      if (error.code == 'INSUFFICIENT_FUNDS') {
        return ({ code: 400, message: messageCode.msgInsufficientFunds, details: error.reason });
      }
      if (error.code === 'NONCE_EXPIRED') {
        return ({ code: 429, message: messageCode.msgNonceExpired, details: error.reason });
      }
      if (retryCount > 0) {
        if (error.code === 'ETIMEDOUT') {
          console.log(`Connection timed out. Retrying... Attempts left: ${retryCount}`);
          await holdExecution(2000);
          return issueCertificateWithRetry(certificateNumber, certificateHash, expirationEpoch, retryCount - 1, gasPrice);
        } else if (error.code === 'REPLACEMENT_UNDERPRICED' || error.code === 'UNPREDICTABLE_GAS_LIMIT' || error.code === 'TRANSACTION_REPLACEMENT_ERROR') {
          console.log(`Replacement fee too low. Retrying with a higher gas price... Attempts left: ${retryCount}`);
          // Convert 10% to a factor of 110 (as we want to increase by 10%)
          var factor = BigInt(110);
          var divisor = BigInt(100);
          // Increase the gas price by 10%
          var increasedGasPrice = (gasPrice * factor) / divisor;
          console.log("increasedGasPrice", increasedGasPrice);
          await holdExecution(2000);
          return issueCustomCertificateWithRetry(certificateNumber, certificateHash, expirationEpoch, retryCount - 1, increasedGasPrice);
        } else if (error.code === 'CALL_EXCEPTION') {
          console.log(error.reason);
          // if (error.reason == 'Only the trusted issuer can perform this operation') {
          //   // Issue Single Certification on Blockchain
          //   let tx = await newContract.addTrustedOwner(
          //     process.env.ACCOUNT_ADDRESS,
          //     {
          //       gasPrice: gasPrice, // Pass the gas price
          //     }
          //   );
          //   let txHash = tx.hash;
          //   if(txHash){
          //     return issueCustomCertificateWithRetry(certificateNumber, certificateHash, retryCount - 1, gasPrice = null);
          //   }
          // }
          return ({ code: 400, message: error.reason });
        }
      }
      console.error("Request rate limit exceeded. Please try again later.", error);
      return ({ code: 429, message: messageCode.msgLimitExceeded, details: error.response });
    }
  };

  module.exports = {
    // Function to call smart contract function
    getContractFunctionWithRetry
};