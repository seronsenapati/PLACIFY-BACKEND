import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getUserApplications } from "../controllers/userController.js";
import { getRecruiterDashboard } from "../controllers/recruiterController.js";

const router = express.Router();

router.get("/:id/applications", protect, getUserApplications);
router.get("/recruiter/dashboard", protect, getRecruiterDashboard);

export default router;
