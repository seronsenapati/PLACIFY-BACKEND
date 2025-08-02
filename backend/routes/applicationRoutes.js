import express from "express";

import { getStudentApplications } from "../controllers/getStudentApplications.js";
import { getJobApplications } from "../controllers/getJobApplications.js";
import { updateApplicationStatus } from "../controllers/applicationController.js";

import protect from "../middleware/authMiddleware.js";
import {
  isStudent,
  isRecruiter,
} from "../middleware/rbacMiddleware.js";

const router = express.Router();

// Get applications submitted by the logged-in student
router.get("/student", protect, isStudent, getStudentApplications);

// Get all applications for a specific job (accessible by recruiter only)
router.get("/job/:jobId", protect, isRecruiter, getJobApplications);

// Update status of a specific application (accessible by recruiter only)
router.patch("/:id", protect, isRecruiter, updateApplicationStatus);

export default router;
