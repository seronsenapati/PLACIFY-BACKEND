import express from "express";
import {
  getAllCompanies,
  createCompany,
  getCompanyById,
} from "../controllers/companyController.js";
import protect from "../middleware/authMiddleware.js";
import { body } from "express-validator";
import validateRequest from "../middleware/validate.js";

const router = express.Router();

router.get("/", getAllCompanies);
router.post(
  "/",
  protect,
  [
    body("name").notEmpty().withMessage("Company name is required"),
    body("desc").notEmpty().withMessage("Description is required"),
    body("website").isURL().withMessage("Website must be a valid URL"),
  ],
  validateRequest,
  createCompany
);
router.get("/:id", getCompanyById);

export default router;
