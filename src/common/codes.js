module.exports = {

    // Tasks Messages
    msgDbReady: "Database connection is Ready",
    msgDbNotReady: "Database connection is Not Ready",
    msgIssueWithDB: "Unable to connect with Database, Please try again...",
    msgImageError: "Unable to generate Image, Please try again...",
    msgPdfError: "Unable to generate PDF Certification, Please try again...",
    msgUploadError: "Unable to upload Image, Please try again...",
    msgDatesMustNotSame: "Grant date and Expiration date must not be same",

    // Response code messages
    msgInternalError: "Internal server error",
    msgWorkInProgress: "🚧 !⚠! Work In Porgress !⚠! 🚧",

    // Handle Excel File messages
    msgInvalidExcel: "Invalid Excel file, Please try again",
    msgExcelLimit: "Application can support upto 250 (Excel file should have 250 certifications maximum)",
    msgInvalidCertIds: "Excel file has invalid certification IDs length (each: min 12 - max 20)",
    msgExcelRepetetionIds: "Excel file has repetition in certification IDs",
    msgInvalidDateFormat: "File has invalid Date format, Recommended MM/DD/YYYY format ",
    msgInvalidDates: "File has invalid Dates",
    msgInvalidGrantDate: "File has invalid Grant Date format, Recommended MM/DD/YYYY format ",
    msgInvalidExpirationDate: "File has invalid Expiration Date format, Recommended MM/DD/YYYY format ",
    msgOlderDateThanNewDate: "File has Future grant date than Expiration Date",
    msgExcelHasExistingIds: "Excel file has Existing Certification IDs",
    msgInvalidHeaders: "Invalid headers in the Excel file.",
    msgExcelSheetname: "The Excel file Sheet name should be - Batch.",
    msgMissingDetailsInExcel: "The Excel file has missing fields, Please fill all required fields and try again",
    msgFailedToIssueAfterRetry: "Failed to issue certification after retries. Please try again...",
    msgFailedToGrantRoleRetry: "Failed to Grant Role after retries. Please try again...",
    msgFailedToRevokeRoleRetry: "Failed to Revoke Role after retries. Please try again...",
    msgFailedToUpdateStatusRetry: "Failed to Update status after retries. Please try again...",
    msgFailedToRenewRetry: "Failed to Extend expiration after retries. Please try again...",
    msgErrorInFetching: "Error in fetching details",
    msgNoMatchFoundInDates: "No match Found on given date",

    // Handle Excel with Zip
    msgMustZip: "Must upload Zip file format",
    msgUnableToFindFiles: "Unable to find valid files in the uploaded zip.",
    msgUnableToFindPdfFiles: "Unable to find Certification pdf files.",
    msgUnableToFindExcelFiles: "Unable to find Excel files.",
    msgAbleToFindFiles: "Able to find files.",
    msgInputRecordsNotMatched: "Bulk input Certifications (pdf) are not matched with Excel records",
    msgFailedToIssueBulkCerts: "Failed to issue Bulk certifications, Please try again",
    msgNoEntryMatchFound: "No matching entry found for Certifcate",
    msgFaileToIssueAfterRetry: "Failed to issue certificate after retries.",
    msgValidDocumentsUploaded: "Uploaded valid documents and excel file",
    msgUnableToConvert: "Unable to convert the file, please check file format data and upload again...",

    // Validation Error codes Issues (Route)
    msgInvalidFile: "Invalid file uploaded / Please Try again ...",
    msgEnterInvalid: "Entered invalid input / Please check and try again...",
    msgInvalidEmail: "Entered invalid Email",
    msgNonEmpty: "Input field cannot be empty",
    msgInputProvide: "Input should be provided",
    msgInvalidFormat: "Entered input format is invalid ",
    msgCertLength: "Certification ID must between 12 to 20 characters",
    msgMaxLength: "Entered Input must between 8 to 30 characters",
    msgMaxLengthCourse: "Entered Input must not exceed 150 characters",
    msgVlidCertNoDb: "Certification is valid perhaps Details unavailable",
    msgInvalidOrganization: "Entered invalid organization / not exist.",
    msgInvalidParams: "Dynamic QR details not found, Please set QR position and try again",

    // API response codes in Issues (Controller)
    msgAuthMissing: "Authorization token is missing",
    msgTokenExpired: "Authorization token has expired",
    msgInvalidToken: "Provided invalid Token",
    msgInvalidKey: "Please provide valid key to validate token",
    msgInvalidFilePath: "Provided invalid file path",
    msgMustPdf: "Must upload PDF file format",
    msgMustExcel: "Must upload Excel file format",
    msgPlsEnterValid: "Please provide valid details",
    msgInvalidIssuer: "Invalid Issuer email",
    msgCertIdRequired: "Certification ID is required",
    msgUnauthIssuer: "Unauthorised Issuer Email",
    msgInvalidEthereum: "Invalid Ethereum address format",
    msgCertIssuedSuccess: "Certification issued successfully",
    msgBatchIssuedSuccess: "Batch of Certifications issued successfully",
    msgInvalidPdfUploaded: "Invalid PDF document uploaded",
    msgInvalidPdfQr: "Invalid PDF (Document Template / QR) dimensions",
    msgCertIssued: "Certification ID already issued",
    msgOpsRestricted: "Operation restricted by the Blockchain",
    msgIssuerUnauthrized: "Unauthorized Issuer to perform operation on Blockchain",
    msgFailedAtBlockchain: "Failed to interact with Blockchain / Please Try again ...",
    msgFailedOpsAtBlockchain: "Failed to perform opertaion at Blockchain / Please Try again ...",
    msgMultiPagePdf: "Multiple Pages PDF document is not allowed, Please try again with valid single page PDF...",
    msgProvideValidDates : "Please provide valid dates (MM/DD/YYYY)",
    msgInvalidPdfTemplate : "Invalid PDF (Certification Template / QR Position) dimensions",

    // Admin controller messages
    msgAdminMailExist: "Admin with the provided email already exists",
    msgSignupSuccess: "Signup successful",
    msgValidCredentials: "Provided valid credentials",
    msgInvalidCredentials: "Provided invalid credentials!",
    msgInvalidPassword: "Invalid password entered!",
    msgErrorOnPwdCompare: "An error occurred while comparing passwords",
    msgErrorOnExistUser: "An error occurred while checking for existing user",
    msgLogoutSuccess: "Admin Logged out successfully",
    msgErrorInLogout: "An error occurred during the logout!",
    msgPwdSuccess: "Password reset successful",
    msgPwdNotSame: "Password cannot be the same as the previous one!",
    msgErrorOnUser: "An error occurred while saving user account!",
    msgErrorOnHashing: "An error occurred while hashing password!",
    msgErrorOnPwdReset: "An error occurred during password reset process!",
    msgCertNotValid: "Certification is not valid",
    msgCertValid: "Certification is Valid",
    msgCertNotExist: "Certification doesn't exist",
    msgCertValidNoDetails: "Certification is valid but No Details found",
    msgAllIssuersFetched: "All Issuer details fetched successfully",
    msgAllQueryFetched: "Requested details fetched successfully",
    msgErrorOnFetching: "An error occurred while fetching Issuer details",
    msgProvideValidStatus: "Please provide valid status as 1 : approve or 2 : reject",
    msgProvideValidFilter: "Please provide valid filter as 1: name, 2: course, 3: Expiration date, 4: certificate ID",
    msgProvideValidCertStatus: "Please provide valid status",
    msgTypeRestricted: "Please provide valid type input (1, 2 or 3)",
    msgProvideValidType: "Please provide valid type as 1, 2 or 3",
    msgOrganizationFetched: "Organization details fetched successfully",

    // Blockchain route Messages
    msgInvalidInput : "Invalid Input parameter",
    msgUserNotFound: "Issuer not found!",
    msgNoMatchFound: "No matching results found",
    msgIssuerRejectSuccess: "Issuer Rejected successfully",
    msgExistRejectIssuer: "Existed Rejected Issuer",
    msgRejecetedAlready: "Issuer Rejected already",
    msgExistedVerified: "Existed Verified Issuer",
    msgIssuerApproveSuccess: "Issuer Approved successfully",
    msgIssueInValidation: "An error occurred during the Issuer validation process!",
    msgAddressExistBlockchain: "Address Existed in the Blockchain",
    msgAddressNotExistBlockchain: "Address Doesn't Existed in the Blockchain",
    msgAdminGrant: "Admin Role Granted",
    msgIssuerRoleGrant: "Issuer Role Granted",
    msgAdminRevoke: "Admin Role Revoked",
    msgIssuerRoleRevoke: "Issuer Role Revoked",
    msgBalanceCheck: "Balance check successful",
    msgNonZero: "Input must not zero or Negative",
    

    // Dates Messages
    msgInvalidDate: "Invalid Date, recommended (MM/DD/YYYY) Please check and try again ...",
    msgOlderGrantDate: "Expiration date must not older than Grant date, Please check and try again ...",
    msgInvalidExpiration: "Please provide valid expiration date or provide more than 30 days from today and try again...",
    msgInvalidNewExpiration: "Please provide valid newer expiration date or provide more than 30 days from today and try again...",
    msgUpdateExpirationNotPossible: "Extension of Expiration not possible on infinite Expiration certification",
    msgUpdateBatchExpirationNotPossible: "Extension of Batch Expiration not possible on infinite Expiration",

    //Renew/status update Messages
    msgCertBadRenewStatus: "Extend Expiration date not possible on the certification",
    msgEpirationMustGreater: "Please provide greater exipration date than existed expiration date",
    msgCertRenewedSuccess: "Certification expiration extended successfully",
    msgCommonBatchExpiration: "Batch of certification has common Expiration date",
    msgStatusAlreadyExist: "The certification status previously existed",
    msgBatchStatusRenened: "Batch expirataion renewed",
    msgBatchStatusUpdated: "Batch status updated",
    msgInvalidBatch: "Invalid batch details provided",
    msgBatchStatusUpdatedNotPossible: "Batch status updating operation not possible",
    msgOperationNotPossible: "Operation not possible on the certification",
    msgNotPossibleBatch: "Operation not possible on the Batch certification",
    msgReactivationNotPossible: "Certification must be revoked to perform Reactivation",
    msgNotPossibleOnRevoked: "Operation not possible on the Revoked certification",
    msgNotPossibleOnRevokedBatch: "Operation not possible on the Revoked Batch certification",
    msgInvalidRootPassed: "Invalid Batch certification value passed",
    msgBatchRenewed: "Batch Expiration date updated / Renewed",
    msgBatchExpired: "Provided Batch details were expired",
    msgRevokeNotPossible: "Operation not possible on provided Certification",

    // Verify certID/pdf Messages
    msgInvalidCert: "Invalid Certification",
    msgCertRevoked: "Certification has revoked",
    msgCertExpired: "Certification has expired",

    // Admin dashboard & Graph Analytics
    msgInvalidGraphInput: "Please provide valid Graph Input",
    msgUnableToGetGraphData: "Unable to fetched Graph data",
    msgGraphDataFetched: "Graph data fetched successfully",
    msgUserEmailNotFound: "Invalid email provided",
    msgDbError: "Unable to connect with Database, Please try again",
    msgIssueFound: "Certification details found",
    msgIssueNotFound: "Certification details not found",
    msgIssuerIdExist: "Issuer ID existed in Issuer Details",

    // URL shortening API
    msgInvalidUrl: "Please provide vaid URL",
    msgErrorInUrl: "Error in generating pre-signed URL",

    // Credits
    msgInsufficientCredits: "Issuer has insufficient credits to perform the operation",
    msgCreditBalance: "Have low credit balance",
    msgValidCredits: "Please provide valid (non-negative) credits count",
    msgNumericOnly: 'Input must contain only numbers.',
    msgProvideValidService: "Please provide valid service code",
    msgFetchQuotaFailed: "Failed to fetch requested credits details",
    msgCreditsUpdatedSuccess: "Credits limit updated successfully",
    msgInvalidStatus: "Invalid Status entered (Recommended True/False)",
    msgAdminNotFound: "Provided admin email not found / Unauthorized admin",
    msgMatchLimitsFound: "Match Credits limit results found",
    msgMatchLimitsNotFound: "No Match Credits limit results found",
    msgIssuerQuotaStatus: "Issuer restricted to perform service",
    msgFailedToUpdateQuotas: "Failed to update credit limits quota for Issuers",
    msgInvalidIssuerId: "Invalid Issuer (or) Issuer ID not found, Please check",
    msgIssuerQuotaExceeded: "Your account has insufficient credits to perform this operation",

};