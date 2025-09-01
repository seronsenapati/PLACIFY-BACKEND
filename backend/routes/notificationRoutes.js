import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getNotifications,
  markAsRead,
  markSingleAsRead,
  deleteNotifications,
  getStats,
  getNotificationTypes,
} from "../controllers/notificationController.js";
import { isRecruiterOrStudent } from "../middleware/rbacMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get paginated notifications with filtering and search
 * @query   page, limit, unread, type, priority, search, startDate, endDate
 * @access  Private (Student | Recruiter | Admin)
 */
router.get("/", protect, isRecruiterOrStudent, getNotifications);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics for the user
 * @access  Private (Student | Recruiter | Admin)
 */
router.get("/stats", protect, isRecruiterOrStudent, getStats);

/**
 * @route   GET /api/notifications/types
 * @desc    Get available notification types and priorities
 * @access  Private (Student | Recruiter | Admin)
 */
router.get("/types", protect, isRecruiterOrStudent, getNotificationTypes);

/**
 * @route   PATCH /api/notifications/mark-read
 * @desc    Mark all user notifications as read (with optional filters)
 * @body    type, priority (optional filters)
 * @access  Private (Student | Recruiter | Admin)
 */
router.patch("/mark-read", protect, isRecruiterOrStudent, markAsRead);

/**
 * @route   PATCH /api/notifications/:id/mark-read
 * @desc    Mark single notification as read
 * @access  Private (Student | Recruiter | Admin)
 */
router.patch("/:id/mark-read", protect, isRecruiterOrStudent, markSingleAsRead);

/**
 * @route   DELETE /api/notifications
 * @desc    Delete user notifications with optional criteria
 * @body    ids, type, priority, read, olderThan (all optional)
 * @access  Private (Student | Recruiter | Admin)
 */
router.delete("/", protect, isRecruiterOrStudent, deleteNotifications);

export default router;
