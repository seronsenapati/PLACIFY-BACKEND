import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getUserApplications } from "../controllers/userController.js";
import { getRecruiterDashboard } from "../controllers/recruiterController.js";
import { isStudent, isRecruiterOrAdmin } from "../middleware/rbacMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/users/:id/applications
 * @desc    Get applications submitted by a student
 * @access  Private (Student only)
 */
router.get("/:id/applications", protect, isStudent, getUserApplications);

/**
 * @route   GET /api/users/recruiter/dashboard
 * @desc    Get recruiter dashboard statistics
 * @access  Private (Recruiter or Admin)
 */
router.get("/recruiter/dashboard", protect, isRecruiterOrAdmin, getRecruiterDashboard);

export default router;
