import express from "express";
import protect from "../middleware/authMiddleware.js";
import multer from "multer";
import {
  updateProfileInfo,
  changePassword,
} from "../controllers/settingsController.js";
import uploadProfilePhoto from "../controllers/uploadProfilePhoto.js";

const router = express.Router();

// Update profile info (name, email, profile pic)
router.patch(
  "/profile",
  protect,
  uploadProfilePhoto.single("profilePhoto"),
  updateProfileInfo
);

// Change password
router.patch("/password", protect, changePassword);

export default router;
