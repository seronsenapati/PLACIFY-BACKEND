import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import { sendErrorResponse } from '../utils/sendResponse.js';
import { logWarn } from '../utils/logger.js';

/**
 * XSS Sanitization Middleware
 * Sanitizes user input to prevent XSS attacks
 */
export const xssSanitizer = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logWarn('XSS sanitization error', {
      error: error.message,
      endpoint: req.originalUrl,
      method: req.method,
      userId: req.user?.id
    });
    return sendErrorResponse(res, 'SEC_002');
  }
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    // Remove potentially dangerous HTML/JS
    return xss(obj, {
      whiteList: {}, // No HTML tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
  }

  return obj;
}

/**
 * NoSQL Injection Prevention Middleware
 * Uses express-mongo-sanitize to prevent NoSQL injection attacks
 */
export const noSqlSanitizer = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logWarn('NoSQL injection attempt detected', {
      key,
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });
  }
});

/**
 * Application-specific input validation
 */
export const applicationInputValidator = (req, res, next) => {
  try {
    // Validate application status updates
    if (req.body.status) {
      const allowedStatuses = ['pending', 'reviewed', 'rejected', 'withdrawn'];
      if (!allowedStatuses.includes(req.body.status)) {
        return sendErrorResponse(res, 'APP_003', { allowedStatuses });
      }
    }

    // Validate and sanitize cover letter
    if (req.body.coverLetter) {
      req.body.coverLetter = req.body.coverLetter.trim();
      
      // Remove excessive whitespace
      req.body.coverLetter = req.body.coverLetter.replace(/\\s+/g, ' ');
      
      // Check length
      if (req.body.coverLetter.length > 2000) {
        return sendErrorResponse(res, 'VAL_002', { 
          field: 'coverLetter',
          maxLength: 2000,
          currentLength: req.body.coverLetter.length
        });
      }
    }

    // Validate withdrawal reason
    if (req.body.reason) {
      req.body.reason = req.body.reason.trim();
      req.body.reason = req.body.reason.replace(/\\s+/g, ' ');
      
      if (req.body.reason.length > 500) {
        return sendErrorResponse(res, 'VAL_002', { 
          field: 'reason',
          maxLength: 500,
          currentLength: req.body.reason.length
        });
      }
    }

    // Validate search parameters
    if (req.query.search) {
      req.query.search = req.query.search.trim();
      
      // Limit search query length
      if (req.query.search.length > 100) {
        return sendErrorResponse(res, 'VAL_002', { 
          field: 'search',
          maxLength: 100,
          currentLength: req.query.search.length
        });
      }
    }

    // Validate pagination parameters
    if (req.query.page) {
      const page = parseInt(req.query.page);
      if (isNaN(page) || page < 1 || page > 1000) {
        return sendErrorResponse(res, 'VAL_002', { 
          field: 'page',
          message: 'Page must be between 1 and 1000'
        });
      }
      req.query.page = page;
    }

    if (req.query.limit) {
      const limit = parseInt(req.query.limit);
      if (isNaN(limit) || limit < 1 || limit > 50) {
        return sendErrorResponse(res, 'VAL_002', { 
          field: 'limit',
          message: 'Limit must be between 1 and 50'
        });
      }
      req.query.limit = limit;
    }

    next();
  } catch (error) {
    logWarn('Application input validation error', {
      error: error.message,
      endpoint: req.originalUrl,
      method: req.method,
      userId: req.user?.id
    });
    return sendErrorResponse(res, 'VAL_001');
  }
};

/**
 * File upload validation middleware
 */
export const fileUploadValidator = (req, res, next) => {
  try {
    if (req.file) {
      // Validate file size (10MB limit)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxFileSize) {
        return sendErrorResponse(res, 'VAL_004', {
          maxSize: '10MB',
          receivedSize: Math.round(req.file.size / 1024 / 1024 * 100) / 100 + 'MB'
        });
      }

      // Validate file type for resumes
      if (req.route?.path?.includes('apply')) {
        const allowedMimeTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          return sendErrorResponse(res, 'VAL_003', {
            allowedTypes: 'PDF, DOCX',
            receivedType: req.file.mimetype
          });
        }
      }

      // Validate filename
      if (req.file.originalname) {
        // Remove special characters from filename
        req.file.originalname = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // Limit filename length
        if (req.file.originalname.length > 255) {
          req.file.originalname = req.file.originalname.substring(0, 255);
        }
      }
    }

    next();
  } catch (error) {
    logWarn('File upload validation error', {
      error: error.message,
      endpoint: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      filename: req.file?.originalname
    });
    return sendErrorResponse(res, 'VAL_001');
  }
};

export default {
  xssSanitizer,
  noSqlSanitizer,
  applicationInputValidator,
  fileUploadValidator
};