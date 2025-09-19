import express from "express";
import {
  getAllCompanies,
  createCompany,
  getCompanyById,
  updateCompanyById,
  deleteCompanyById,
  getCompanyStats,
  getCompanyAnalytics,
  getCompanyActivity,
  getCompanyProfileCompletion
} from "../controllers/companyController.js";

import protect from "../middleware/authMiddleware.js";
import { isRecruiterOrAdmin, isAdmin } from "../middleware/rbacMiddleware.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { validateObjectId } from "../middleware/objectIdValidator.js";
import uploadProfilePhoto from "../controllers/uploadProfilePhoto.js";
import reviewRoutes from "./reviewRoutes.js";

const router = express.Router();

// Use review routes for /:companyId/reviews
router.use("/:companyId/reviews", validateObjectId("companyId"), reviewRoutes);

// GET all companies with filtering and pagination
router.get("/", getAllCompanies);

// GET company statistics
router.get("/stats", getCompanyStats);

// GET company analytics
router.get("/analytics", getCompanyAnalytics);

// CREATE a company
router.post(
  "/",
  protect,
  isRecruiterOrAdmin,
  uploadProfilePhoto.single("logo"),
  [
    body("name").notEmpty().withMessage("Company name is required"),
    body("desc").notEmpty().withMessage("Description is required"),
    body("website").isURL().withMessage("Website must be a valid URL"),
    body("location").optional().isString().withMessage("Location must be a string"),
    body("industry").optional().isString().withMessage("Industry must be a string"),
    body("size").optional().isIn(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"])
      .withMessage("Size must be one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+"),
    body("employeeCount").optional().isInt({ min: 0 }).withMessage("Employee count must be a positive number"),
    body("socialMedia.linkedin").optional().isURL().withMessage("LinkedIn URL must be valid"),
    body("socialMedia.twitter").optional().isURL().withMessage("Twitter URL must be valid"),
    body("socialMedia.facebook").optional().isURL().withMessage("Facebook URL must be valid"),
    body("socialMedia.instagram").optional().isURL().withMessage("Instagram URL must be valid")
  ],
  validateRequest,
  createCompany
);

// GET a company by ID
router.get("/:id", validateObjectId("id"), getCompanyById);

// GET company profile completion
router.get("/:id/profile-completion", validateObjectId("id"), getCompanyProfileCompletion);

// GET company activity log
router.get("/:id/activity", validateObjectId("id"), getCompanyActivity);

// UPDATE a company by ID (PATCH for partial update)
router.patch(
  "/:id",
  protect,
  isRecruiterOrAdmin,
  uploadProfilePhoto.single("logo"),
  validateObjectId("id"),
  [
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("desc").optional().notEmpty().withMessage("Description cannot be empty"),
    body("website").optional().isURL().withMessage("Website must be a valid URL"),
    body("location").optional().isString().withMessage("Location must be a string"),
    body("industry").optional().isString().withMessage("Industry must be a string"),
    body("size").optional().isIn(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"])
      .withMessage("Size must be one of: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+"),
    body("employeeCount").optional().isInt({ min: 0 }).withMessage("Employee count must be a positive number"),
    body("socialMedia.linkedin").optional().isURL().withMessage("LinkedIn URL must be valid"),
    body("socialMedia.twitter").optional().isURL().withMessage("Twitter URL must be valid"),
    body("socialMedia.facebook").optional().isURL().withMessage("Facebook URL must be valid"),
    body("socialMedia.instagram").optional().isURL().withMessage("Instagram URL must be valid")
  ],
  validateRequest,
  updateCompanyById
);

// DELETE a company by ID
router.delete(
  "/:id",
  protect,
  isRecruiterOrAdmin,
  validateObjectId("id"),
  deleteCompanyById
);

export default router;