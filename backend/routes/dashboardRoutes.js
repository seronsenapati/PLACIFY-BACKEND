import express from "express";
import { query } from "express-validator";

import { 
  getStudentDashboardOverview,
  getStudentApplicationAnalytics,
  getRecruiterDashboardOverview,
  getAdminDashboardOverview
} from "../controllers/dashboardController.js";

import protect from "../middleware/authMiddleware.js";
import { isStudent, isRecruiter, isAdmin } from "../middleware/rbacMiddleware.js";
import validateRequest from "../middleware/validate.js";
import { generalApiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All dashboard routes require authentication
router.use(protect);

// Get student dashboard overview
router.get(
  "/student/overview", 
  isStudent,
  generalApiLimiter,
  getStudentDashboardOverview
);

// Get student application analytics
router.get(
  "/student/analytics", 
  isStudent,
  [
    query("timeframe")
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage("Timeframe must be between 1 and 365 days")
  ],
  validateRequest,
  getStudentApplicationAnalytics
);

// Get recruiter dashboard overview
router.get(
  "/recruiter/overview", 
  isRecruiter,
  generalApiLimiter,
  getRecruiterDashboardOverview
);

// Get admin dashboard overview
router.get(
  "/admin/overview", 
  isAdmin,
  generalApiLimiter,
  getAdminDashboardOverview
);

export default router;