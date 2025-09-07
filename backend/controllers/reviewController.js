import Review from "../models/Review.js";
import Company from "../models/Company.js";
import sendResponse from "../utils/sendResponse.js";
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError, logWarn } from "../utils/logger.js";

// POST - Create a new review
export const createReview = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Review creation initiated", {
      requestId,
      userId: req.user.id,
      companyId: req.params.companyId
    });
    
    const { rating, title, comment } = req.body;
    
    // Validate required fields
    if (!rating || !title || !comment) {
      logWarn("Review creation failed - missing required fields", {
        requestId,
        userId: req.user.id,
        companyId: req.params.companyId,
        missingFields: [
          !rating ? 'rating' : null,
          !title ? 'title' : null,
          !comment ? 'comment' : null
        ].filter(Boolean)
      });
      
      return sendResponse(
        res,
        400,
        false,
        "Rating, title, and comment are required",
        null,
        requestId
      );
    }
    
    // Validate rating range
    if (rating < 1 || rating > 5) {
      logWarn("Review creation failed - invalid rating", {
        requestId,
        userId: req.user.id,
        companyId: req.params.companyId,
        rating
      });
      
      return sendResponse(
        res,
        400,
        false,
        "Rating must be between 1 and 5",
        null,
        requestId
      );
    }
    
    // Check if company exists
    const company = await Company.findById(req.params.companyId);
    if (!company) {
      logWarn("Review creation failed - company not found", {
        requestId,
        userId: req.user.id,
        companyId: req.params.companyId
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Company not found",
        null,
        requestId
      );
    }
    
    // Check if user has already reviewed this company
    const existingReview = await Review.findOne({
      company: req.params.companyId,
      user: req.user.id
    });
    
    if (existingReview) {
      logWarn("Review creation failed - user already reviewed company", {
        requestId,
        userId: req.user.id,
        companyId: req.params.companyId
      });
      
      return sendResponse(
        res,
        409,
        false,
        "You have already reviewed this company",
        null,
        requestId
      );
    }
    
    // Create review
    const review = await Review.create({
      company: req.params.companyId,
      user: req.user.id,
      rating,
      title,
      comment
    });
    
    // Update company rating
    await company.updateRating();
    
    // Log activity
    await company.logActivity("review_added", req.user.id, {
      reviewId: review._id,
      rating: review.rating
    });
    
    logInfo("Review created successfully", {
      requestId,
      userId: req.user.id,
      companyId: req.params.companyId,
      reviewId: review._id
    });
    
    return sendResponse(
      res,
      201,
      true,
      "Review created successfully",
      review,
      requestId
    );
  } catch (error) {
    logError("Review creation failed", error, {
      requestId,
      userId: req.user.id,
      companyId: req.params.companyId
    });
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return sendResponse(
        res,
        409,
        false,
        "You have already reviewed this company",
        null,
        requestId
      );
    }
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during review creation",
      null,
      requestId
    );
  }
};

// GET - Get reviews for a company
export const getCompanyReviews = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Fetching company reviews", {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.companyId
    });
    
    // Check if company exists
    const company = await Company.findById(req.params.companyId);
    if (!company) {
      logWarn("Fetching company reviews failed - company not found", {
        requestId,
        userId: req.user?.id || 'anonymous',
        companyId: req.params.companyId
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Company not found",
        null,
        requestId
      );
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get reviews with user details
    const reviews = await Review.getReviewsWithUsers(req.params.companyId, page, limit);
    
    // Get total count
    const total = await Review.countDocuments({ company: req.params.companyId });
    
    const response = {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
    
    logInfo("Company reviews fetched successfully", {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.companyId,
      count: reviews.length
    });
    
    return sendResponse(
      res,
      200,
      true,
      "Reviews fetched successfully",
      response,
      requestId
    );
  } catch (error) {
    logError("Fetching company reviews failed", error, {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.companyId
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during reviews fetch",
      null,
      requestId
    );
  }
};

// PATCH - Update a review
export const updateReview = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Review update initiated", {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId
    });
    
    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      logWarn("Review update failed - review not found", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Review not found",
        null,
        requestId
      );
    }
    
    // Check if user owns the review
    if (review.user.toString() !== req.user.id) {
      logWarn("Review update failed - unauthorized", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId,
        reviewOwner: review.user
      });
      
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to update this review",
        null,
        requestId
      );
    }
    
    const { rating, title, comment } = req.body;
    
    // Validate rating range if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      logWarn("Review update failed - invalid rating", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId,
        rating
      });
      
      return sendResponse(
        res,
        400,
        false,
        "Rating must be between 1 and 5",
        null,
        requestId
      );
    }
    
    // Store old rating for activity log
    const oldRating = review.rating;
    
    // Update review fields
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    
    await review.save();
    
    // Update company rating
    const company = await Company.findById(review.company);
    if (company) {
      await company.updateRating();
      
      // Log activity
      await company.logActivity("review_updated", req.user.id, {
        reviewId: review._id,
        oldRating,
        newRating: review.rating
      });
    }
    
    logInfo("Review updated successfully", {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId
    });
    
    return sendResponse(
      res,
      200,
      true,
      "Review updated successfully",
      review,
      requestId
    );
  } catch (error) {
    logError("Review update failed", error, {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during review update",
      null,
      requestId
    );
  }
};

// DELETE - Delete a review
export const deleteReview = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Review deletion initiated", {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId
    });
    
    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      logWarn("Review deletion failed - review not found", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Review not found",
        null,
        requestId
      );
    }
    
    // Check if user owns the review or is admin
    if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
      logWarn("Review deletion failed - unauthorized", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId,
        reviewOwner: review.user,
        userRole: req.user.role
      });
      
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to delete this review",
        null,
        requestId
      );
    }
    
    const companyId = review.company;
    const rating = review.rating;
    
    await Review.findByIdAndDelete(req.params.reviewId);
    
    // Update company rating
    const company = await Company.findById(companyId);
    if (company) {
      await company.updateRating();
      
      // Log activity
      await company.logActivity("review_deleted", req.user.id, {
        rating
      });
    }
    
    logInfo("Review deleted successfully", {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId
    });
    
    return sendResponse(
      res,
      200,
      true,
      "Review deleted successfully",
      null,
      requestId
    );
  } catch (error) {
    logError("Review deletion failed", error, {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during review deletion",
      null,
      requestId
    );
  }
};

// POST - Vote on a review (helpful/unhelpful)
export const voteOnReview = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Review voting initiated", {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId,
      vote: req.body.vote
    });
    
    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      logWarn("Review voting failed - review not found", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Review not found",
        null,
        requestId
      );
    }
    
    const vote = req.body.vote;
    
    // Validate vote
    if (vote !== 'helpful') {
      logWarn("Review voting failed - invalid vote", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId,
        vote
      });
      
      return sendResponse(
        res,
        400,
        false,
        "Vote must be 'helpful'",
        null,
        requestId
      );
    }
    
    // Update helpful votes
    review.helpfulVotes += 1;
    await review.save();
    
    logInfo("Review voted on successfully", {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId,
      helpfulVotes: review.helpfulVotes
    });
    
    return sendResponse(
      res,
      200,
      true,
      "Vote recorded successfully",
      { helpfulVotes: review.helpfulVotes },
      requestId
    );
  } catch (error) {
    logError("Review voting failed", error, {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during review voting",
      null,
      requestId
    );
  }
};