import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
} from "../controllers/authController.js";

import protect from "../middleware/authMiddleware.js";
import { validateRegistration } from "../middleware/authValidation.js";

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (only student or recruiter)
 * @access  Public
 */
router.post("/register", validateRegistration, registerUser);

/**
 * @route   POST /api/auth/login
 * @desc    Login a user (student, recruiter, or admin)
 * @access  Public
 */
router.post("/login", loginUser);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout the current user
 * @access  Private
 */
router.post("/logout", protect, logoutUser);

export default router;
