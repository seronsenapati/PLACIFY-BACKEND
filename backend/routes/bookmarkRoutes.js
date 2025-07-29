import express from "express";
import {
  bookmarkJob,
  getBookmarkedJobs,
} from "../controllers/bookmarkController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/bookmarks/:jobId – Bookmark a job
router.post("/:jobId", protect, bookmarkJob);

// GET /api/bookmarks – Get all bookmarked jobs
router.get("/", protect, getBookmarkedJobs);

export default router;
