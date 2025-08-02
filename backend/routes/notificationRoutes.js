import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getNotifications,
  markAsRead,
  deleteNotifications,
} from "../controllers/notificationController.js";
import { isRecruiterOrStudent } from "../middleware/rbacMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for logged-in user
 * @access  Private (Student | Recruiter | Admin)
 */
router.get("/", protect, isRecruiterOrStudent, getNotifications);

/**
 * @route   PATCH /api/notifications/mark-read
 * @desc    Mark all user notifications as read
 * @access  Private (Student | Recruiter | Admin)
 */
router.patch("/mark-read", protect, isRecruiterOrStudent, markAsRead);

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all user notifications
 * @access  Private (Student | Recruiter | Admin)
 */
router.delete("/", protect, isRecruiterOrStudent, deleteNotifications);

export default router;
