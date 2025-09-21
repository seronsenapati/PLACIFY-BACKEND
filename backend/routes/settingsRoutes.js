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
  (req, res, next) => {
    uploadProfilePhoto.single("profilePhoto")(req, res, (err) => {
      if (err) {
        console.error("Profile photo upload middleware error:", {
          error: err,
          message: err.message,
          stack: err.stack,
        });
        
        // Handle file size errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: "Profile photo is too large. Please upload an image smaller than 3MB.",
          });
        }
        
        // Handle file type errors
        if (err.message && err.message.includes('Only image files are allowed')) {
          return res.status(400).json({
            success: false,
            message: "Please upload a valid image file (JPEG, PNG, GIF).",
          });
        }
        
        return res.status(400).json({
          success: false,
          message: err.message || "Error uploading profile photo",
          error:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      }
      next();
    });
  },
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