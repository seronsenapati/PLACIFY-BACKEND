import express from "express";
import { body } from "express-validator";
import {
  createJob,
  getAllJobs,
  updateJob,
  deleteJob,
  getJobById,
  applyToJob,
  getRecruiterJobs,
  getJobStats,
  getBookmarkedJobs,
  generateJobDescription
} from "../controllers/jobController.js";
import protect from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validate.js";
import uploadResume from "../controllers/resumeUploadController.js";
import { isRecruiterOrAdmin, isStudent } from "../middleware/rbacMiddleware.js";
import validateObjectId from "../middleware/objectIdValidator.js";
import { applicationSubmissionLimiter, generalApiLimiter } from "../middleware/rateLimiter.js";

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
  generalApiLimiter,
  [
    body("title").notEmpty().withMessage("Title is required").trim(),
    body("role").notEmpty().withMessage("Role is required").trim(),
    body("desc").notEmpty().withMessage("Description is required").trim(),
    body("location").notEmpty().withMessage("Location is required").trim(),
    body("salary").isNumeric().withMessage("Salary must be a number"),
    body("skills").isArray({ min: 1 }).withMessage("Skills must be an array with at least one item"),
    body("expiresAt").optional().isISO8601().withMessage("Expiration date must be a valid date"),
    body("applicationDeadline").optional().isISO8601().withMessage("Application deadline must be a valid date"),
    body("experienceLevel").optional().isIn(["entry", "mid", "senior", "lead"]).withMessage("Invalid experience level"),
    body("company").optional().isMongoId().withMessage("Company must be a valid ID")
  ],
  validateRequest,
  createJob
);

/**
 * @route   POST /api/jobs/generate-description
 * @desc    Generate job description using AI
 * @access  Private (Recruiters & Admins)
 */
router.post(
  "/generate-description",
  protect,
  isRecruiterOrAdmin,
  generalApiLimiter,
  [
    body("title").notEmpty().withMessage("Title is required").trim(),
    body("role").notEmpty().withMessage("Role is required").trim(),
    body("location").optional().trim(),
    body("jobType").optional().isIn(["internship", "full-time", "part-time", "contract"]).withMessage("Invalid job type"),
    body("experienceLevel").optional().isIn(["entry", "mid", "senior", "lead"]).withMessage("Invalid experience level"),
    body("skills").optional().isArray().withMessage("Skills must be an array")
  ],
  validateRequest,
  generateJobDescription
);

/**
 * @route   GET /api/jobs
 * @desc    Get all jobs
 * @access  Public
 */
router.get("/", generalApiLimiter, getAllJobs);

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job by ID
 * @access  Public
 */
router.get("/:id", generalApiLimiter, validateObjectId("id"), getJobById);

/**
 * @route   PATCH /api/jobs/:id
 * @desc    Update a job
 * @access  Private (Recruiters & Admins)
 */
router.patch(
  "/:id",
  protect,
  isRecruiterOrAdmin,
  generalApiLimiter,
  validateObjectId("id"),
  [
    body("title").optional().trim(),
    body("role").optional().trim(),
    body("desc").optional().trim(),
    body("location").optional().trim(),
    body("salary").optional().isNumeric().withMessage("Salary must be a number"),
    body("skills").optional().isArray().withMessage("Skills must be an array"),
    body("jobType").optional().isIn(["internship", "full-time", "part-time", "contract"]).withMessage("Invalid job type"),
    body("expiresAt").optional().isISO8601().withMessage("Expiration date must be a valid date"),
    body("applicationDeadline").optional().isISO8601().withMessage("Application deadline must be a valid date"),
    body("status").optional().isIn(["active", "inactive", "expired"]).withMessage("Invalid status"),
    body("experienceLevel").optional().isIn(["entry", "mid", "senior", "lead"]).withMessage("Invalid experience level"),
    body("company").optional().isMongoId().withMessage("Company must be a valid ID")
  ],
  validateRequest,
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
  generalApiLimiter,
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

/**
 * @route   GET /api/jobs/recruiter/my-jobs
 * @desc    Get all jobs posted by the recruiter
 * @access  Private (Recruiters & Admins)
 */
router.get(
  "/recruiter/my-jobs",
  protect,
  isRecruiterOrAdmin,
  generalApiLimiter,
  getRecruiterJobs
);

/**
 * @route   GET /api/jobs/recruiter/stats
 * @desc    Get job statistics for the recruiter
 * @access  Private (Recruiters & Admins)
 */
router.get(
  "/recruiter/stats",
  protect,
  isRecruiterOrAdmin,
  generalApiLimiter,
  getJobStats
);

/**
 * @route   GET /api/jobs/student/bookmarks
 * @desc    Get bookmarked jobs for student
 * @access  Private (Students only)
 */
router.get(
  "/student/bookmarks",
  protect,
  isStudent,
  generalApiLimiter,
  getBookmarkedJobs
);

export default router;