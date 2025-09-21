import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  getProfile,
  updateProfile,
  deleteResume,
} from "../controllers/profileController.js";
import uploadProfilePhoto from "../controllers/uploadProfilePhoto.js";
import uploadResume from "../controllers/resumeUploadController.js";

const router = express.Router();

// Get user profile
router.get("/", protect, getProfile);

// Update profile photo - uses your existing uploadProfilePhoto controller
router.patch(
  "/photo",
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
  updateProfile // Uses main updateProfile function
);

// Update resume - uses your existing uploadResume controller
router.patch(
  "/resume",
  protect,
  (req, res, next) => {
    uploadResume.single("resume")(req, res, (err) => {
      if (err) {
        console.error("Resume upload middleware error:", {
          error: err,
          message: err.message,
          stack: err.stack,
        });
        
        // Handle file size errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: "Resume file is too large. Please upload a file smaller than 10MB.",
          });
        }
        
        // Handle file type errors
        if (err.message && (err.message.includes('Only PDF and DOCX files are allowed') || 
                           err.message.includes('Invalid file type'))) {
          return res.status(400).json({
            success: false,
            message: "Please upload a valid resume file (PDF or DOCX).",
          });
        }
        
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
  updateProfile // Uses main updateProfile function
);

// Delete resume
router.delete("/resume", protect, deleteResume);

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
