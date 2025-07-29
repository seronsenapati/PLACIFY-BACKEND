import express from "express";
import {
  createJob,
  getAllJobs,
  updateJob,
  deleteJob,
  getJobById,
  applyToJob,
} from "../controllers/jobController.js";
import protect from "../middleware/authMiddleware.js";
import { body } from "express-validator";
import validateRequest from "../middleware/validate.js";
import upload from "../controllers/uploadMiddleware.js";

const router = express.Router();

// Create a job
router.post(
  "/",
  protect,
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

// Get all jobs
router.get("/", getAllJobs);

// Update a job
router.patch("/:id", protect, updateJob);

// Delete a job
router.delete("/:id", protect, deleteJob);

//get job by ID
router.get("/:id", getJobById);

// Apply to a job (with resume upload)
router.post("/:jobId/apply", protect, upload.single("resume"), applyToJob);

export default router;
