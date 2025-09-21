// Standardized Error Codes for PLACIFY-BACKEND Application
// Categories: AUTH, USER, JOB, APPLICATION, COMPANY, VALIDATION, SYSTEM, SECURITY, NOTIFICATION, FILE

export const ERROR_CODES = {
  // Authentication Errors (AUTH_xxx)
  AUTH_001: {
    code: 'AUTH_001',
    userMessage: 'Incorrect email or password. Please try again.',
    technicalMessage: 'Email or password is incorrect',
    httpStatus: 401
  },
  AUTH_002: {
    code: 'AUTH_002',
    userMessage: 'Please log in to access this resource.',
    technicalMessage: 'No valid token provided',
    httpStatus: 401
  },
  AUTH_003: {
    code: 'AUTH_003',
    userMessage: 'Your session has expired. Please log in again.',
    technicalMessage: 'JWT token has expired',
    httpStatus: 401
  },
  AUTH_004: {
    code: 'AUTH_004',
    userMessage: 'This account has been deactivated. Please contact support.',
    technicalMessage: 'User account is marked as inactive',
    httpStatus: 403
  },
  AUTH_005: {
    code: 'AUTH_005',
    userMessage: 'You don\'t have permission to perform this action.',
    technicalMessage: 'User role does not have required permissions',
    httpStatus: 403
  },

  // User Management Errors (USER_xxx)
  USER_001: {
    code: 'USER_001',
    userMessage: 'User not found. The account may have been deleted.',
    technicalMessage: 'User with provided ID does not exist',
    httpStatus: 404
  },
  USER_002: {
    code: 'USER_002',
    userMessage: 'An account with this email already exists. Please try logging in.',
    technicalMessage: 'User with this email already exists',
    httpStatus: 409
  },
  USER_003: {
    code: 'USER_003',
    userMessage: 'Invalid user ID format. Please check the URL and try again.',
    technicalMessage: 'Provided user ID is not a valid MongoDB ObjectId',
    httpStatus: 400
  },

  // Job Management Errors (JOB_xxx)
  JOB_001: {
    code: 'JOB_001',
    userMessage: 'Job not found. It may have been removed or expired.',
    technicalMessage: 'Job with provided ID does not exist',
    httpStatus: 404
  },
  JOB_002: {
    code: 'JOB_002',
    userMessage: 'You don\'t have permission to modify this job.',
    technicalMessage: 'User is not the creator of this job',
    httpStatus: 403
  },
  JOB_003: {
    code: 'JOB_003',
    userMessage: 'Invalid job ID format. Please check the URL and try again.',
    technicalMessage: 'Provided job ID is not a valid MongoDB ObjectId',
    httpStatus: 400
  },
  JOB_004: {
    code: 'JOB_004',
    userMessage: 'Please create a company profile before posting jobs.',
    technicalMessage: 'Recruiter must create company profile before posting jobs',
    httpStatus: 400
  },
  JOB_005: {
    code: 'JOB_005',
    userMessage: 'The application deadline for this job has passed.',
    technicalMessage: 'Cannot apply to job after application deadline',
    httpStatus: 400
  },

  // Application Management Errors (APP_xxx)
  APP_001: {
    code: 'APP_001',
    userMessage: 'Application not found. It may have been deleted.',
    technicalMessage: 'Application with provided ID does not exist',
    httpStatus: 404
  },
  APP_002: {
    code: 'APP_002',
    userMessage: 'You\'ve already applied to this job. Duplicate applications are not allowed.',
    technicalMessage: 'Duplicate application detected for same job and student',
    httpStatus: 409
  },
  APP_003: {
    code: 'APP_003',
    userMessage: 'Invalid application status. Please select a valid status.',
    technicalMessage: 'Status must be one of: pending, reviewed, rejected, withdrawn',
    httpStatus: 400
  },
  APP_004: {
    code: 'APP_004',
    userMessage: 'You don\'t have permission to update this application.',
    technicalMessage: 'User does not own the job associated with this application',
    httpStatus: 403
  },
  APP_005: {
    code: 'APP_005',
    userMessage: 'Please upload your resume to apply for this job.',
    technicalMessage: 'No resume file provided in the request',
    httpStatus: 400
  },
  APP_006: {
    code: 'APP_006',
    userMessage: 'Invalid application ID format. Please check the URL and try again.',
    technicalMessage: 'Provided application ID is not a valid MongoDB ObjectId',
    httpStatus: 400
  },
  APP_007: {
    code: 'APP_007',
    userMessage: 'This application cannot be withdrawn at this stage.',
    technicalMessage: 'Application status does not allow withdrawal',
    httpStatus: 400
  },

  // Company Management Errors (COMPANY_xxx)
  COMPANY_001: {
    code: 'COMPANY_001',
    userMessage: 'Company not found. It may have been removed.',
    technicalMessage: 'Company with provided ID does not exist',
    httpStatus: 404
  },
  COMPANY_002: {
    code: 'COMPANY_002',
    userMessage: 'You don\'t have permission to modify this company.',
    technicalMessage: 'User is not the creator of this company or company not found',
    httpStatus: 403
  },

  // Validation Errors (VAL_xxx)
  VAL_001: {
    code: 'VAL_001',
    userMessage: 'Please fill in all required fields.',
    technicalMessage: 'One or more required fields were not provided',
    httpStatus: 400
  },
  VAL_002: {
    code: 'VAL_002',
    userMessage: 'Please check your input and try again.',
    technicalMessage: 'Input data does not match expected format',
    httpStatus: 400
  },
  VAL_003: {
    code: 'VAL_003',
    userMessage: 'File type not supported. Please upload a valid file format.',
    technicalMessage: 'Uploaded file type is not in the allowed formats',
    httpStatus: 400
  },
  VAL_004: {
    code: 'VAL_004',
    userMessage: 'File is too large. Please upload a smaller file.',
    technicalMessage: 'Uploaded file size exceeds the maximum allowed limit',
    httpStatus: 400
  },
  VALIDATION_001: {
    code: 'VALIDATION_001',
    userMessage: 'Please check the form for errors and try again.',
    technicalMessage: 'Input data failed validation checks',
    httpStatus: 400
  },

  // System Errors (SYS_xxx)
  SYS_001: {
    code: 'SYS_001',
    userMessage: 'Something went wrong on our end. Please try again later.',
    technicalMessage: 'Unexpected server error during request processing',
    httpStatus: 500
  },
  SYS_002: {
    code: 'SYS_002',
    userMessage: 'Database connection error. Please try again later.',
    technicalMessage: 'Failed to connect to the database',
    httpStatus: 500
  },
  SYS_003: {
    code: 'SYS_003',
    userMessage: 'Service temporarily unavailable. Please try again later.',
    technicalMessage: 'Third-party service integration failed',
    httpStatus: 503
  },

  // Security Errors (SEC_xxx)
  SEC_001: {
    code: 'SEC_001',
    userMessage: 'Too many attempts. Please wait a few minutes before trying again.',
    technicalMessage: 'Rate limit exceeded for this IP address',
    httpStatus: 429
  },
  SEC_002: {
    code: 'SEC_002',
    userMessage: 'Suspicious activity detected. Please try again or contact support.',
    technicalMessage: 'Input failed security validation checks',
    httpStatus: 400
  },

  // Notification Errors (NOT_xxx)
  NOT_001: {
    code: 'NOT_001',
    userMessage: 'Notification not found. It may have been deleted.',
    technicalMessage: 'Notification with provided ID does not exist',
    httpStatus: 404
  },
  NOT_002: {
    code: 'NOT_002',
    userMessage: 'Failed to send notification. Please try again later.',
    technicalMessage: 'Notification delivery service error',
    httpStatus: 500
  },

  // File Management Errors (FILE_xxx)
  FILE_001: {
    code: 'FILE_001',
    userMessage: 'File upload failed. Please try again or use a different file.',
    technicalMessage: 'Error occurred during file upload to cloud storage',
    httpStatus: 500
  },
  FILE_002: {
    code: 'FILE_002',
    userMessage: 'File not found. It may have been removed.',
    technicalMessage: 'Requested file does not exist in storage',
    httpStatus: 404
  }
};

// Helper function to get error by code
export const getErrorByCode = (code) => {
  return ERROR_CODES[code] || ERROR_CODES.SYS_001;
};

// Helper function to create standardized error response
export const createErrorResponse = (code, requestId = null, additionalData = {}) => {
  const error = getErrorByCode(code);
  return {
    success: false,
    error: {
      code: error.code,
      message: error.userMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        technicalMessage: error.technicalMessage 
      }),
      ...(requestId && { requestId }),
      ...additionalData
    }
  };
};

export default ERROR_CODES;