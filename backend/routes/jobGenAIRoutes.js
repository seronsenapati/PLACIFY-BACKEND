import express from "express";
import { generateJobDescription } from "../controllers/jobGenAIController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isRecruiter } from "../middleware/rbacMiddleware.js";

const router = express.Router();

/**
 * @route   POST /api/ai/job-description
 * @desc    Generate job description using AI
 * @access  Private (Recruiters only)
 */
router.post("/job-desc", protect, isRecruiter, generateJobDescription);

export default router;
