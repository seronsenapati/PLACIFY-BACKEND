import express from "express";
import protect from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import uploadProfilePhoto from "../middleware/uploadProfilePhoto.js";
import uploadResume from "../middleware/uploadResume.js";

const router = express.Router();

// Get user profile
router.get("/", protect, getProfile);

// Update profile photo
router.patch(
  "/photo",
  protect,
  (req, res, next) => {
    uploadProfilePhoto.single("profilePhoto")(req, res, (err) => {
      if (err) {
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
  updateProfile
);

// Update resume
router.patch(
  "/resume",
  protect,
  (req, res, next) => {
    uploadResume.single("resume")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "Error uploading resume",
          error:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      }
      next();
    });
  },
  updateProfile
);

// Update profile data (non-file fields)
router.patch(
  "/",
  protect,
  (req, res, next) => {
    // Validate content type for non-file updates
    const contentType = req.headers["content-type"];
    if (contentType && contentType.includes("multipart/form-data")) {
      return res.status(400).json({
        success: false,
        message: "Use /photo or /resume endpoints for file uploads",
      });
    }
    next();
  },
  updateProfile
);

export default router;
