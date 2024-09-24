module.exports = {

    // Tasks Messages
    msgDbReady: "Database connection is Ready",
    msgDbNotReady: "Database connection is Not Ready",
    msgIssueWithDB: "Unable to connect with Database, Please try again...",
    msgImageError: "Unable to generate Image, Please try again...",
    msgPdfError: "Unable to generate PDF Credential, Please try again...",
    msgUploadError: "Unable to upload Image, Please try again...",
    msgDatesMustNotSame: "Grant date and Expiration date must not be same",

    // Response code messages
    msgPageNotFound: "Page not found",
    msgInternalError: "Unable to reach the server, Please try again...",
    msgWorkInProgress: "🚧 !⚠! Work In Porgress !⚠! 🚧",

    // Handle Excel File messages
    msgInvalidExcel: "Invalid Excel file, Please try again",
    msgExcelLimit: "Application can support issue credentials maximum ",
    msgInvalidCertIds: "Excel file has invalid credential IDs length (each: min 12 - max 25)",
    msgExcelRepetetionIds: "Excel file has repetition in credentail IDs",
    msgInvalidDateFormat: "File has invalid Date format, Recommended MM/DD/YYYY format ",
    msgInvalidDates: "File has invalid Dates",
    msgInvalidGrantDate: "File has invalid Grant Date format, Recommended MM/DD/YYYY format ",
    msgInvalidExpirationDate: "File has invalid Expiration Date format, Recommended MM/DD/YYYY format ",
    msgOlderDateThanNewDate: "File has Future grant date than Expiration Date",
    msgExcelHasExistingIds: "Excel file has Existing Credential IDs",
    msgInvalidHeaders: "Invalid headers in the Excel file.",
    msgExcelSheetname: "The Excel file Sheet name should be - Batch.",
    msgMissingDetailsInExcel: "The Excel file has missing fields, Please fill all required fields and try again",
    msgFailedToIssueAfterRetry: "Failed to issue credential after retries. Please try again...",
    msgFailedToGrantRoleRetry: "Failed to Grant Role after retries. Please try again...",
    msgFailedToRevokeRoleRetry: "Failed to Revoke Role after retries. Please try again...",
    msgFailedToUpdateStatusRetry: "Failed to Update status after retries. Please try again...",
    msgFailedToRenewRetry: "Failed to Extend expiration after retries. Please try again...",
    msgErrorInFetching: "Unable to fetch requested details",
    msgNoMatchFoundInDates: "No match Found on given date",
    msgOnlyAlphabets: "Please provide names with valid format",

    // Handle Excel with Zip
    msgMustZip: "Must upload Zip file format",
    msgUnableToFindFiles: "Unable to find valid files in the uploaded zip.",
    msgUnableToFindPdfFiles: "Unable to find Credential pdf files.",
    msgUnableToFindExcelFiles: "Unable to find Excel file in the upload.",
    msgAbleToFindFiles: "Able to find files.",
    msgInputRecordsNotMatched: "Bulk input Credentials (pdf) are not matched with Excel records",
    msgFailedToIssueBulkCerts: "Failed to issue Bulk credentials, Please try again",
    msgNoEntryMatchFound: "No matching entry found for Certifcate",
    msgFaileToIssueAfterRetry: "Failed to issue credential after retries.",
    msgValidDocumentsUploaded: "Uploaded valid documents and excel file",
    msgUnableToConvert: "Unable to convert the file, please check file format data and upload again...",
    msgMultipagePdfError: "Multiple-page PDF documents are not allowed. Please try again with a valid single-page PDF",
    msgProvideValidExcel: "Excel file has invalid details, Please verify and try again...",
    msgNoHeaderSpecified: "Data entered without a corresponding header.",


    // Validation Error codes Issues (Route)
    msgInvalidFile: "Invalid file uploaded / Please Try again ...",
    msgEnterInvalid: "Entered invalid input / Please check and try again...",
    msgInvalidEmail: "Entered invalid Email",
    msgNonEmpty: "Input field cannot be empty",
    msgInputProvide: "Input should be provided",
    msgInvalidFormat: "Entered input format is invalid ",
    msgCertLength: "Credential ID must between 12 to 20 characters",
    msgMaxLength: "Entered Input must between 8 to 30 characters",
    msgMaxLengthCourse: "Entered Input must not exceed 150 characters",
    msgVlidCertNoDb: "Credential is valid perhaps Details unavailable",
    msgInvalidOrganization: "Entered invalid organization / not exist.",
    msgInvalidParams: "Dynamic QR details not found, Please set QR position and try again",
    msgInvalidFlag: "Provide valid flag value",
    msgCertificateRepeated: "Provided credential number already allocated for existed issue",


    // API response codes in Issues (Controller)
    msgAuthMissing: "Authorization token is missing",
    msgTokenExpired: "Authorization token has expired",
    msgInvalidToken: "Provided invalid Token",
    msgInvalidKey: "Please provide valid key to validate token",
    msgInvalidFilePath: "Provided invalid file path",
    msgMustPdf: "Must upload PDF file format",
    msgMustExcel: "Must upload Excel file format",
    msgPlsEnterValid: "Please provide valid details",
    msgInvalidIssuer: "Invalid / Inactive Issuer email",
    msgCertIdRequired: "Credential ID is required",
    msgUnauthIssuer: "Unauthorised Issuer Email",
    msgInvalidEthereum: "Invalid Ethereum address format",
    msgCertIssuedSuccess: "Credential issued successfully",
    msgBatchIssuedSuccess: "Batch of Credentials issued successfully",
    msgInvalidPdfUploaded: "Invalid PDF document uploaded",
    msgInvalidPdfQr: "Invalid PDF (Document Template / QR) dimensions",
    msgCertIssued: "Credential ID already issued",
    msgOpsRestricted: "Operation restricted by the Blockchain",
    msgIssuerUnauthrized: "Unauthorized Issuer to perform operation on Blockchain",
    msgFailedAtBlockchain: "Failed to interact with Blockchain / Please Try again ...",
    msgFailedOpsAtBlockchain: "Failed to perform opertaion at Blockchain / Please Try again ...",
    msgMultiPagePdf: "Multiple-page PDF documents are not allowed. Please try again with a valid single-page PDF",
    msgProvideValidDates : "Please provide valid dates (MM/DD/YYYY)",
    msgInvalidPdfTemplate : "Invalid PDF (Credential Template / QR Position) dimensions",
    msgInvalidPdfDimensions : "Invalid PDF Template / dimensions are not matching with provided documents",
    msgInvalidQrTemplate: "To add a QR code to the existing pdf, please provide the PDF(s) without any QR code.",

    // Admin controller messages
    msgAdminMailExist: "Admin with the provided email already exists",
    msgSignupSuccess: "Signup successful",
    msgValidCredentials: "Provided valid admin details",
    msgInvalidCredentials: "Provided invalid admin detials",
    msgInvalidPassword: "Invalid password entered!",
    msgErrorOnPwdCompare: "There was an issue while verifying the passwords",
    msgErrorOnExistUser: "There was a problem while verifying if the user already exists",
    msgLogoutSuccess: "Admin Logged out successfully",
    msgErrorInLogout: "There was a problem while logging out, Please try again",
    msgPwdSuccess: "Password reset successful",
    msgPwdNotSame: "Password cannot be the same as the previous one!",
    msgErrorOnUser: "Unable to save user account!, Please try again",
    msgErrorOnHashing: "Unable to perform hashing password!",
    msgErrorOnPwdReset: "Unable to reset the password, Please try again",
    msgCertNotValid: "Credential is not valid",
    msgCertValid: "Credential is Valid",
    msgCertNotExist: "Credential doesn't exist",
    msgCertValidNoDetails: "Credential is valid but No Details found",
    msgAllIssuersFetched: "All Issuer details fetched successfully",
    msgAllQueryFetched: "Requested details fetched successfully",
    msgErrorOnFetching: "Unable to fetch Issuer details, Please try again",
    msgProvideValidStatus: "Please provide valid status as 1 : approve or 2 : reject",
    msgProvideValidFilter: "Please provide valid filter key",
    msgProvideValidValue: "Please provide valid filter Value",
    msgProvideValidCertStatus: "Please provide valid status",
    msgTypeRestricted: "Please provide valid type input (1, 2 or 3)",
    msgProvideValidType: "Please provide valid type as 1, 2 or 3",
    msgOrganizationFetched: "Organization details fetched successfully",

    // Blockchain route Messages
    msgInvalidInput : "Invalid Input parameter",
    msgUserNotFound: "Issuer not found! / Issuer not Approved",
    msgNoMatchFound: "No matching results found",
    msgIssuerRejectSuccess: "Issuer Rejected successfully",
    msgExistRejectIssuer: "Existed Rejected Issuer",
    msgRejecetedAlready: "Issuer Rejected already",
    msgExistedVerified: "Existed Verified Issuer",
    msgIssuerApproveSuccess: "Issuer Approved successfully",
    msgIssueInValidation: "Unable to validate the Issuer, Please try again",
    msgAddressExistBlockchain: "Address Existed in the Blockchain",
    msgAddressNotExistBlockchain: "Address Doesn't Existed in the Blockchain",
    msgAdminGrant: "Admin Role Granted",
    msgIssuerRoleGrant: "Issuer Role Granted",
    msgAdminRevoke: "Admin Role Revoked",
    msgIssuerRoleRevoke: "Issuer Role Revoked",
    msgBalanceCheck: "Balance check successful",
    msgNonZero: "Input must not zero or Negative",
    msgLimitExceeded: "Request rate limit exceeded. Please try again later.",
    msgNonceExpired: "Transaction Nonce expired. Cannot retry.",
    msgDbEntryNotFound: "Transaction found in blockchain, unable to find more details",
    msgInvalidArguments: "Please provide valid arguments to the blockchain",
    msgInsufficientFunds: "Insufficient fund to perform blockchain operation",
    msgPreviosTxInProgress: "Previous transaction still in progress at blockchain, Please wait for the response",
    

    // Dates Messages
    msgInvalidDate: "Invalid Date, recommended (MM/DD/YYYY) Please check and try again ...",
    msgOlderGrantDate: "Expiration date must not older than Grant date, Please check and try again ...",
    msgInvalidExpiration: "Please provide valid expiration date or provide more than 30 days from today and try again...",
    msgInvalidNewExpiration: "Please provide valid newer expiration date or provide more than 30 days from today and try again...",
    msgUpdateExpirationNotPossible: "Extension of Expiration not possible on infinite Expiration credential",
    msgUpdateBatchExpirationNotPossible: "Extension of Batch Expiration not possible on infinite Expiration",

    //Renew/status update Messages
    msgCertBadRenewStatus: "Extend Expiration date not possible on the credential",
    msgEpirationMustGreater: "Please provide greater exipration date than existed expiration date",
    msgCertRenewedSuccess: "Credential expiration extended successfully",
    msgCommonBatchExpiration: "Batch of credentials has common Expiration date",
    msgStatusAlreadyExist: "The credential status previously existed",
    msgBatchStatusRenened: "Batch expirataion renewed",
    msgBatchStatusUpdated: "Batch status updated",
    msgInvalidBatch: "Invalid batch details provided",
    msgBatchStatusUpdatedNotPossible: "Batch status updating operation not possible",
    msgOperationNotPossible: "Operation not possible on the credential",
    msgNotPossibleBatch: "Operation not possible on the Batch credential",
    msgReactivationNotPossible: "Credential must be revoked to perform Reactivation",
    msgNotPossibleOnRevoked: "Operation not possible on the Revoked credential",
    msgNotPossibleOnRevokedBatch: "Operation not possible on the Revoked Batch credential",
    msgInvalidRootPassed: "Invalid Batch credential value passed",
    msgBatchRenewed: "Batch Expiration date updated / Renewed",
    msgBatchExpired: "Provided Batch details were expired",
    msgRevokeNotPossible: "Operation not possible on provided Credential",

    // Verify certID/pdf Messages
    msgInvalidCert: "Invalid Credential",
    msgCertRevoked: "Credential has revoked",
    msgCertExpired: "Credential has expired",

    // Admin dashboard & Graph Analytics
    msgInvalidGraphInput: "Please provide valid Graph Input",
    msgUnableToGetGraphData: "Unable to fetched Graph data",
    msgGraphDataFetched: "Graph data fetched successfully",
    msgUserEmailNotFound: "Invalid email provided / issuer not approved",
    msgDbError: "Unable to connect with Database, Please try again",
    msgIssueFound: "Credential details found",
    msgIssueNotFound: "Credential details not found",
    msgIssuerIdExist: "Issuer ID existed in Issuer Details",

    // URL shortening API
    msgInvalidUrl: "Please provide vaid URL",
    msgErrorInUrl: "Unable to generate pre-signed URL",

    // Credits
    msgInsufficientCredits: "Issuer has insufficient credits to perform the operation",
    msgCreditBalance: "Have low credit balance",
    msgValidCredits: "Please provide valid (non-negative) credits count",
    msgNumericOnly: 'Input must contain only numbers.',
    msgProvideValidService: "Please provide valid service code",
    msgFetchQuotaFailed: "Failed to fetch requested credits details",
    msgCreditsUpdatedSuccess: "Credits limit updated successfully",
    msgInvalidStatus: "Invalid Status entered (Recommended True/False)",
    msgInvalidStatusValue: "Invalid Status entered",
    msgAdminNotFound: "Provided admin email not found / Unauthorized admin",
    msgMatchLimitsFound: "Match Credits limit results found",
    msgMatchLimitsNotFound: "No Match Credits limit results found",
    msgIssuerQuotaStatus: "Issuer restricted to perform service",
    msgFailedToUpdateQuotas: "Failed to update credit limits quota for Issuers",
    msgNoCreditsForService: "Unable to provide credits to issuer for locked service",
    msgInvalidIssuerId: "Invalid Issuer (or) Issuer ID not found, Please check",
    msgIssuerQuotaExceeded: "Your account has insufficient credits to perform this operation",
    msgRpcFailed: "Invalid Address / RPC provider endpoint failed",

};