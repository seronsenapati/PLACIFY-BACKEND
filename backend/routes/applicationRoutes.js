import express from "express";
import { getStudentApplications } from "../controllers/getStudentApplications.js";
import { getJobApplications } from "../controllers/getJobApplications.js";
import { updateApplicationStatus } from "../controllers/applicationController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/student", protect, getStudentApplications);
router.get("/job/:jobId", protect, getJobApplications);
router.patch("/:id", protect, updateApplicationStatus);

export default router;
