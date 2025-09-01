import express from "express";
import { body, query } from "express-validator";

import { 
  getStudentApplications, 
  getStudentApplicationStats 
} from "../controllers/getStudentApplications.js";
import { 
  getJobApplications, 
  exportJobApplications 
} from "../controllers/getJobApplications.js";
import { 
  updateApplicationStatus, 
  withdrawApplication, 
  getApplicationAnalytics 
} from "../controllers/applicationController.js";

import protect from "../middleware/authMiddleware.js";
import {
  isStudent,
  isRecruiter,
} from "../middleware/rbacMiddleware.js";
import validateObjectId from "../middleware/objectIdValidator.js";
import validateRequest from "../middleware/validate.js";
import { applicationUpdateLimiter, generalApiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Get applications submitted by the logged-in student
router.get(
  "/student", 
  protect, 
  isStudent, 
  [
    query("status")
      .optional()
      .isIn(["pending", "reviewed", "rejected", "withdrawn"])
      .withMessage("Invalid status filter"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50")
  ],
  validateRequest,
  getStudentApplications
);

// Get application statistics for student
router.get(
  "/student/stats", 
  protect, 
  isStudent,
  [
    query("timeframe")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Timeframe must be between 1 and 365 days")
  ],
  validateRequest,
  getStudentApplicationStats
);

// Get all applications for a specific job (accessible by recruiter only)
router.get(
  "/job/:jobId", 
  protect, 
  isRecruiter, 
  validateObjectId("jobId"),
  [
    query("status")
      .optional()
      .isIn(["pending", "reviewed", "rejected", "withdrawn"])
      .withMessage("Invalid status filter"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50")
  ],
  validateRequest,
  getJobApplications
);

// Export applications for a specific job
router.get(
  "/job/:jobId/export", 
  protect, 
  isRecruiter, 
  validateObjectId("jobId"),
  [
    query("status")
      .optional()
      .isIn(["pending", "reviewed", "rejected", "withdrawn"])
      .withMessage("Invalid status filter"),
    query("format")
      .optional()
      .isIn(["csv", "json"])
      .withMessage("Format must be csv or json")
  ],
  validateRequest,
  exportJobApplications
);

// Update status of a specific application (accessible by recruiter only)
router.patch(
  "/:id", 
  applicationUpdateLimiter,
  protect, 
  isRecruiter, 
  validateObjectId("id"),
  [
    body("status")
      .isIn(["reviewed", "rejected"])
      .withMessage("Status must be either 'reviewed' or 'rejected'"),
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Reason cannot exceed 500 characters")
  ],
  validateRequest,
  updateApplicationStatus
);

// Withdraw application (accessible by student only)
router.patch(
  "/:id/withdraw", 
  applicationUpdateLimiter,
  protect, 
  isStudent, 
  validateObjectId("id"),
  [
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Reason cannot exceed 500 characters")
  ],
  validateRequest,
  withdrawApplication
);

// Get application analytics (accessible by recruiter only)
router.get(
  "/analytics", 
  protect, 
  isRecruiter,
  [
    query("jobId")
      .optional()
      .isMongoId()
      .withMessage("Invalid job ID format"),
    query("dateFrom")
      .optional()
      .isISO8601()
      .withMessage("Invalid date format for dateFrom"),
    query("dateTo")
      .optional()
      .isISO8601()
      .withMessage("Invalid date format for dateTo")
  ],
  validateRequest,
  getApplicationAnalytics
);

export default router;
