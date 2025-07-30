import express from "express";
import { generateJobDescription } from "../controllers/jobGenAIController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/job-description", protect, generateJobDescription);

export default router;
