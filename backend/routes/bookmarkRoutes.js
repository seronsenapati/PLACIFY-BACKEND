import express from "express";
import {
  bookmarkJob,
  getBookmarkedJobs,
  unbookmarkJob,
  checkIfBookmarked
} from "../controllers/bookmarkController.js";
import protect from "../middleware/authMiddleware.js";
import { isStudent } from "../middleware/rbacMiddleware.js";
import validateObjectId from "../middleware/objectIdValidator.js";

const router = express.Router();

// POST /api/bookmarks/:jobId – Bookmark a job
router.post(
  "/:jobId",
  protect,
  isStudent,
  validateObjectId("jobId"),
  bookmarkJob
);

// GET /api/bookmarks – Get all bookmarked jobs
router.get("/", protect, isStudent, getBookmarkedJobs);

// GET /api/bookmarks/check/:jobId – Check if a job is bookmarked
router.get(
  "/check/:jobId",
  protect,
  isStudent,
  validateObjectId("jobId"),
  checkIfBookmarked
);

// DELETE /api/bookmarks/:jobId – Unbookmark a job
router.delete(
  "/:jobId",
  protect,
  isStudent,
  validateObjectId("jobId"),
  unbookmarkJob
);

export default router;