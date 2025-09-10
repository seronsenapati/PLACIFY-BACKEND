// Standardized Error Codes for PLACIFY-BACKEND Application
// Categories: AUTH, USER, JOB, APPLICATION, COMPANY, VALIDATION, SYSTEM, SECURITY, NOTIFICATION, FILE

export const ERROR_CODES = {
  // Authentication Errors (AUTH_xxx)
  AUTH_001: {
    code: 'AUTH_001',
    userMessage: 'Invalid login credentials',
    technicalMessage: 'Email or password is incorrect',
    httpStatus: 401
  },
  AUTH_002: {
    code: 'AUTH_002',
    userMessage: 'Access denied - authentication required',
    technicalMessage: 'No valid token provided',
    httpStatus: 401
  },
  AUTH_003: {
    code: 'AUTH_003',
    userMessage: 'Session expired, please login again',
    technicalMessage: 'JWT token has expired',
    httpStatus: 401
  },
  AUTH_004: {
    code: 'AUTH_004',
    userMessage: 'Account has been deactivated',
    technicalMessage: 'User account is marked as inactive',
    httpStatus: 403
  },
  AUTH_005: {
    code: 'AUTH_005',
    userMessage: 'You do not have permission to perform this action',
    technicalMessage: 'User role does not have required permissions',
    httpStatus: 403
  },

  // User Management Errors (USER_xxx)
  USER_001: {
    code: 'USER_001',
    userMessage: 'User not found',
    technicalMessage: 'User with provided ID does not exist',
    httpStatus: 404
  },
  USER_002: {
    code: 'USER_002',
    userMessage: 'Email address is already registered',
    technicalMessage: 'User with this email already exists',
    httpStatus: 409
  },
  USER_003: {
    code: 'USER_003',
    userMessage: 'Invalid user ID format',
    technicalMessage: 'Provided user ID is not a valid MongoDB ObjectId',
    httpStatus: 400
  },

  // Job Management Errors (JOB_xxx)
  JOB_001: {
    code: 'JOB_001',
    userMessage: 'Job not found',
    technicalMessage: 'Job with provided ID does not exist',
    httpStatus: 404
  },
  JOB_002: {
    code: 'JOB_002',
    userMessage: 'You are not authorized to modify this job',
    technicalMessage: 'User is not the creator of this job',
    httpStatus: 403
  },
  JOB_003: {
    code: 'JOB_003',
    userMessage: 'Invalid job ID format',
    technicalMessage: 'Provided job ID is not a valid MongoDB ObjectId',
    httpStatus: 400
  },
  JOB_004: {
    code: 'JOB_004',
    userMessage: 'Job creation requires a company profile',
    technicalMessage: 'Recruiter must create company profile before posting jobs',
    httpStatus: 400
  },
  JOB_005: {
    code: 'JOB_005',
    userMessage: 'Application deadline has passed',
    technicalMessage: 'Cannot apply to job after application deadline',
    httpStatus: 400
  },

  // Application Management Errors (APP_xxx)
  APP_001: {
    code: 'APP_001',
    userMessage: 'Application not found',
    technicalMessage: 'Application with provided ID does not exist',
    httpStatus: 404
  },
  APP_002: {
    code: 'APP_002',
    userMessage: 'You have already applied to this job',
    technicalMessage: 'Duplicate application detected for same job and student',
    httpStatus: 409
  },
  APP_003: {
    code: 'APP_003',
    userMessage: 'Invalid application status',
    technicalMessage: 'Status must be one of: pending, reviewed, rejected, withdrawn',
    httpStatus: 400
  },
  APP_004: {
    code: 'APP_004',
    userMessage: 'You are not authorized to update this application',
    technicalMessage: 'User does not own the job associated with this application',
    httpStatus: 403
  },
  APP_005: {
    code: 'APP_005',
    userMessage: 'Resume file is required for job application',
    technicalMessage: 'No resume file provided in the request',
    httpStatus: 400
  },
  APP_006: {
    code: 'APP_006',
    userMessage: 'Invalid application ID format',
    technicalMessage: 'Provided application ID is not a valid MongoDB ObjectId',
    httpStatus: 400
  },
  APP_007: {
    code: 'APP_007',
    userMessage: 'Cannot withdraw application at this stage',
    technicalMessage: 'Application status does not allow withdrawal',
    httpStatus: 400
  },

  // Company Management Errors (COMPANY_xxx)
  COMPANY_001: {
    code: 'COMPANY_001',
    userMessage: 'Company not found',
    technicalMessage: 'Company with provided ID does not exist',
    httpStatus: 404
  },
  COMPANY_002: {
    code: 'COMPANY_002',
    userMessage: 'You are not authorized to modify this company',
    technicalMessage: 'User is not the creator of this company or company not found',
    httpStatus: 403
  },

  // Validation Errors (VAL_xxx)
  VAL_001: {
    code: 'VAL_001',
    userMessage: 'Required fields are missing',
    technicalMessage: 'One or more required fields were not provided',
    httpStatus: 400
  },
  VAL_002: {
    code: 'VAL_002',
    userMessage: 'Invalid input format',
    technicalMessage: 'Input data does not match expected format',
    httpStatus: 400
  },
  VAL_003: {
    code: 'VAL_003',
    userMessage: 'File type not supported',
    technicalMessage: 'Uploaded file type is not in the allowed formats',
    httpStatus: 400
  },
  VAL_004: {
    code: 'VAL_004',
    userMessage: 'File size exceeds limit',
    technicalMessage: 'Uploaded file size exceeds the maximum allowed limit',
    httpStatus: 400
  },
  VALIDATION_001: {
    code: 'VALIDATION_001',
    userMessage: 'Validation failed for one or more fields',
    technicalMessage: 'Input data failed validation checks',
    httpStatus: 400
  },

  // System Errors (SYS_xxx)
  SYS_001: {
    code: 'SYS_001',
    userMessage: 'Internal server error occurred',
    technicalMessage: 'Unexpected server error during request processing',
    httpStatus: 500
  },
  SYS_002: {
    code: 'SYS_002',
    userMessage: 'Database connection error',
    technicalMessage: 'Failed to connect to the database',
    httpStatus: 500
  },
  SYS_003: {
    code: 'SYS_003',
    userMessage: 'External service unavailable',
    technicalMessage: 'Third-party service integration failed',
    httpStatus: 503
  },

  // Security Errors (SEC_xxx)
  SEC_001: {
    code: 'SEC_001',
    userMessage: 'Too many requests, please try again later',
    technicalMessage: 'Rate limit exceeded for this IP address',
    httpStatus: 429
  },
  SEC_002: {
    code: 'SEC_002',
    userMessage: 'Potentially malicious input detected',
    technicalMessage: 'Input failed security validation checks',
    httpStatus: 400
  },

  // Notification Errors (NOT_xxx)
  NOT_001: {
    code: 'NOT_001',
    userMessage: 'Notification not found',
    technicalMessage: 'Notification with provided ID does not exist',
    httpStatus: 404
  },
  NOT_002: {
    code: 'NOT_002',
    userMessage: 'Failed to send notification',
    technicalMessage: 'Notification delivery service error',
    httpStatus: 500
  },

  // File Management Errors (FILE_xxx)
  FILE_001: {
    code: 'FILE_001',
    userMessage: 'File upload failed',
    technicalMessage: 'Error occurred during file upload to cloud storage',
    httpStatus: 500
  },
  FILE_002: {
    code: 'FILE_002',
    userMessage: 'File not found',
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