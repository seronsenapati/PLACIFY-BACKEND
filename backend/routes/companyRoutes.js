import express from "express";
import {
  getAllCompanies,
  createCompany,
  getCompanyById,
  updateCompanyById,
} from "../controllers/companyController.js";

import protect from "../middleware/authMiddleware.js";
import { isRecruiterOrAdmin } from "../middleware/rbacMiddleware.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { validateObjectId } from "../middleware/objectIdValidator.js";
import { logoUpload } from "../controllers/logoUploadController.js";

const router = express.Router();

// GET all companies
router.get("/", getAllCompanies);

// CREATE a company
router.post(
  "/",
  protect,
  isRecruiterOrAdmin,
  logoUpload.single("logo"),
  [
    body("name").notEmpty().withMessage("Company name is required"),
    body("desc").notEmpty().withMessage("Description is required"),
    body("website").isURL().withMessage("Website must be a valid URL"),
  ],
  validateRequest,
  createCompany
);

// GET a company by ID
router.get("/:id", validateObjectId("id"), getCompanyById);

// UPDATE a company by ID (PATCH for partial update)
router.patch(
  "/:id",
  protect,
  isRecruiterOrAdmin,
  logoUpload.single("logo"),
  validateObjectId("id"),
  [
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("desc")
      .optional()
      .notEmpty()
      .withMessage("Description cannot be empty"),
    body("website")
      .optional()
      .isURL()
      .withMessage("Website must be a valid URL"),
  ],
  validateRequest,
  updateCompanyById
);

export default router;
