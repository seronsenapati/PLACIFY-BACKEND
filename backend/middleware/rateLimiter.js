import rateLimit from 'express-rate-limit';
import { sendErrorResponse } from '../utils/sendResponse.js';
import { logWarn } from '../utils/logger.js';

// Rate limiting for application submissions
export const applicationSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 application submissions per windowMs
  message: {
    success: false,
    error: {
      code: 'SEC_001',
      message: 'Too many application submissions, please try again later',
      retryAfter: '15 minutes'
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for admin users
    return req.user?.role === 'admin';
  },
  handler: (req, res) => {
    logWarn('Application submission rate limit reached', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      endpoint: req.originalUrl
    });
    return sendErrorResponse(res, 'SEC_001', {
      retryAfter: '15 minutes',
      limit: 5,
      windowMs: 15 * 60 * 1000
    });
  }
});

// Rate limiting for application status updates
export const applicationUpdateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 status updates per windowMs
  message: {
    success: false,
    error: {
      code: 'SEC_001',
      message: 'Too many application updates, please try again later',
      retryAfter: '5 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.user?.role === 'admin';
  },
  handler: (req, res) => {
    logWarn('Application update rate limit reached', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      endpoint: req.originalUrl
    });
    return sendErrorResponse(res, 'SEC_001', {
      retryAfter: '5 minutes',
      limit: 20,
      windowMs: 5 * 60 * 1000
    });
  }
});

// General API rate limiting
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'SEC_001',
      message: 'Too many requests, please try again later',
      retryAfter: '15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.user?.role === 'admin';
  },
  handler: (req, res) => {
    logWarn('General API rate limit reached', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      endpoint: req.originalUrl
    });
    return sendErrorResponse(res, 'SEC_001', {
      retryAfter: '15 minutes',
      limit: 100,
      windowMs: 15 * 60 * 1000
    });
  }
});

export default {
  applicationSubmissionLimiter,
  applicationUpdateLimiter,
  generalApiLimiter
};