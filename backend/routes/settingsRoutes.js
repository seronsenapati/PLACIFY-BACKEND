import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getProfileInfo,
  updateProfileInfo,
  changePassword,
} from "../controllers/settingsController.js";
import uploadProfilePhoto from "../controllers/uploadProfilePhoto.js";

const router = express.Router();

// ✅ Get profile info (for settings page)
router.get("/profile", protect, getProfileInfo);

// ✅ Update profile info (name, username, email, profile pic)
router.patch(
  "/profile",
  protect,
  uploadProfilePhoto.single("profilePhoto"),
  updateProfileInfo
);

// ✅ Change password
router.patch("/password", protect, changePassword);

export default router;
