import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import uploadProfilePhoto from "../controllers/uploadProfilePhoto.js";

const router = express.Router();

// Get current user's profile
router.get("/", protect, getProfile);

// Update current user's profile
router.patch(
  "/",
  protect,
  uploadProfilePhoto.single("profilePhoto"),
  updateProfile
);

export default router;
