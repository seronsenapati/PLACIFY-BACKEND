import express from "express";
import { body } from "express-validator";
import {
  createJob,
  getAllJobs,
  updateJob,
  deleteJob,
  getJobById,
  applyToJob,
} from "../controllers/jobController.js";
import protect from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validate.js";
import uploadResume from "../controllers/resumeUploadController.js";
import { isRecruiterOrAdmin, isStudent } from "../middleware/rbacMiddleware.js";
import validateObjectId from "../middleware/objectIdValidator.js";
import { applicationSubmissionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/**
 * @route   POST /api/jobs
 * @desc    Create a new job
 * @access  Private (Recruiters & Admins)
 */
router.post(
  "/",
  protect,
  isRecruiterOrAdmin,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("role").notEmpty().withMessage("Role is required"),
    body("desc").notEmpty().withMessage("Description is required"),
    body("location").notEmpty().withMessage("Location is required"),
    body("salary").isNumeric().withMessage("Salary must be a number"),
  ],
  validateRequest,
  createJob
);

/**
 * @route   GET /api/jobs
 * @desc    Get all jobs
 * @access  Public
 */
router.get("/", getAllJobs);

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job by ID
 * @access  Public
 */
router.get("/:id", validateObjectId("id"), getJobById);

/**
 * @route   PATCH /api/jobs/:id
 * @desc    Update a job
 * @access  Private (Recruiters & Admins)
 */
router.patch(
  "/:id",
  protect,
  isRecruiterOrAdmin,
  validateObjectId("id"),
  updateJob
);

/**
 * @route   DELETE /api/jobs/:id
 * @desc    Delete a job
 * @access  Private (Recruiters & Admins)
 */
router.delete(
  "/:id",
  protect,
  isRecruiterOrAdmin,
  validateObjectId("id"),
  deleteJob
);

/**
 * @route   POST /api/jobs/:jobId/apply
 * @desc    Apply to a job (student uploads resume)
 * @access  Private (Students only)
 */
router.post(
  "/:jobId/apply",
  applicationSubmissionLimiter,
  protect,
  isStudent,
  validateObjectId("jobId"),
  [
    body("coverLetter")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Cover letter cannot exceed 2000 characters")
      .trim()
  ],
  validateRequest,
  uploadResume.single("resume"),
  applyToJob
);

export default router;
