import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import uploadProfilePhoto from "../controllers/uploadProfilePhoto.js";
import uploadResume from "../controllers/uploadResume.js";

const router = express.Router();

router.get("/", protect, getProfile);

// Update profile with either photo OR resume OR other fields
router.patch(
  "/photo",
  protect,
  uploadProfilePhoto.single("profilePhoto"),
  updateProfile
);

router.patch("/resume", protect, uploadResume.single("resume"), updateProfile);

router.patch("/", protect, updateProfile); // For text fields only

export default router;
