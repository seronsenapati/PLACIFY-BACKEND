import express from "express";
import {
  createReview,
  getCompanyReviews,
  updateReview,
  deleteReview,
  voteReview
} from "../controllers/reviewController.js";

import protect from "../middleware/authMiddleware.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { validateObjectId } from "../middleware/objectIdValidator.js";

const router = express.Router({ mergeParams: true });

// CREATE a review for a company
router.post(
  "/",
  protect,
  [
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be an integer between 1 and 5"),
    body("title").notEmpty().withMessage("Title is required").isLength({ max: 100 }).withMessage("Title must be less than 100 characters"),
    body("comment").notEmpty().withMessage("Comment is required").isLength({ max: 1000 }).withMessage("Comment must be less than 1000 characters"),
  ],
  validateRequest,
  createReview
);

// GET reviews for a company
router.get("/", getCompanyReviews);

// UPDATE a review
router.patch(
  "/:reviewId",
  protect,
  validateObjectId("reviewId"),
  [
    body("rating").optional().isInt({ min: 1, max: 5 }).withMessage("Rating must be an integer between 1 and 5"),
    body("title").optional().isLength({ max: 100 }).withMessage("Title must be less than 100 characters"),
    body("comment").optional().isLength({ max: 1000 }).withMessage("Comment must be less than 1000 characters"),
  ],
  validateRequest,
  updateReview
);

// DELETE a review
router.delete(
  "/:reviewId",
  protect,
  validateObjectId("reviewId"),
  deleteReview
);

// VOTE on a review (helpful)
router.post(
  "/:reviewId/vote",
  protect,
  validateObjectId("reviewId"),
  [
    body("vote").notEmpty().withMessage("Vote is required").custom((value) => {
      // Accept both string and numeric values
      const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
      if (isNaN(numericValue) || (numericValue !== 1 && numericValue !== -1)) {
        throw new Error("Vote must be 1 (helpful) or -1 (not helpful)");
      }
      return true;
    }),
  ],
  validateRequest,
  voteReview
);

export default router;