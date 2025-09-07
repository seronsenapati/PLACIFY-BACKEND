import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getProfileInfo,
  updateProfileInfo,
  changePassword,
  getNotificationPreferences,
  updateNotificationPreferences,
  resetNotificationPreferences,
  getRecruiterSettings,
  updateRecruiterSettings,
  resetRecruiterSettings,
} from "../controllers/settingsController.js";
import uploadProfilePhoto from "../controllers/uploadProfilePhoto.js";
import { isRecruiter } from "../middleware/rbacMiddleware.js";

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

// ✅ Get notification preferences
router.get("/notifications", protect, getNotificationPreferences);

// ✅ Update notification preferences
router.patch("/notifications", protect, updateNotificationPreferences);

// ✅ Reset notification preferences to default
router.post("/notifications/reset", protect, resetNotificationPreferences);

// ✅ Recruiter-specific settings
// Get recruiter settings
router.get("/recruiter", protect, isRecruiter, getRecruiterSettings);

// Update recruiter settings
router.patch("/recruiter", protect, isRecruiter, updateRecruiterSettings);

// Reset recruiter settings to default
router.post("/recruiter/reset", protect, isRecruiter, resetRecruiterSettings);

export default router;