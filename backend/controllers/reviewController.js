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
      
      const missingFields = [
        !rating ? 'rating' : null,
        !title ? 'title' : null,
        !comment ? 'comment' : null
      ].filter(Boolean);
      
      return sendResponse(
        res,
        400,
        false,
        `Please fill in all required fields: ${missingFields.join(', ')}.`,
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
        "Please provide a rating between 1 and 5 stars.",
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
        "Company not found. The company may have been removed.",
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
        "You have already reviewed this company. You can edit your existing review instead.",
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
        "You have already reviewed this company. You can edit your existing review instead.",
        null,
        requestId
      );
    }
    
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while creating your review. Please try again later.",
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
        "Company not found. The company may have been removed.",
        null,
        requestId
      );
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Fetch reviews with user details (excluding sensitive info)
    const reviews = await Review.find({ company: req.params.companyId })
      .populate('user', 'name profilePhoto') // Only populate name and profile photo
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const totalReviews = await Review.countDocuments({ company: req.params.companyId });
    
    logInfo("Company reviews fetched successfully", {
      requestId,
      companyId: req.params.companyId,
      totalReviews,
      page,
      limit
    });
    
    return sendResponse(
      res,
      200,
      true,
      "Company reviews fetched successfully",
      {
        reviews,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalReviews / limit),
          totalReviews
        }
      },
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
      "Something went wrong while fetching company reviews. Please try again later.",
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
    
    const { rating, title, comment } = req.body;
    
    // Validate required fields
    if (!rating || !title || !comment) {
      logWarn("Review update failed - missing required fields", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId,
        missingFields: [
          !rating ? 'rating' : null,
          !title ? 'title' : null,
          !comment ? 'comment' : null
        ].filter(Boolean)
      });
      
      const missingFields = [
        !rating ? 'rating' : null,
        !title ? 'title' : null,
        !comment ? 'comment' : null
      ].filter(Boolean);
      
      return sendResponse(
        res,
        400,
        false,
        `Please fill in all required fields: ${missingFields.join(', ')}.`,
        null,
        requestId
      );
    }
    
    // Validate rating range
    if (rating < 1 || rating > 5) {
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
        "Please provide a rating between 1 and 5 stars.",
        null,
        requestId
      );
    }
    
    // Check if review exists and belongs to user
    const review = await Review.findOne({
      _id: req.params.reviewId,
      user: req.user.id
    });
    
    if (!review) {
      logWarn("Review update failed - review not found or unauthorized", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Review not found or you don't have permission to update this review.",
        null,
        requestId
      );
    }
    
    // Update review
    review.rating = rating;
    review.title = title;
    review.comment = comment;
    await review.save();
    
    // Update company rating
    const company = await Company.findById(review.company);
    if (company) {
      await company.updateRating();
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
      "Something went wrong while updating your review. Please try again later.",
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
    
    // Check if review exists and belongs to user
    const review = await Review.findOneAndDelete({
      _id: req.params.reviewId,
      user: req.user.id
    });
    
    if (!review) {
      logWarn("Review deletion failed - review not found or unauthorized", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Review not found or you don't have permission to delete this review.",
        null,
        requestId
      );
    }
    
    // Update company rating
    const company = await Company.findById(review.company);
    if (company) {
      await company.updateRating();
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
      "Something went wrong while deleting your review. Please try again later.",
      null,
      requestId
    );
  }
};

// POST - Vote on a review (helpful/unhelpful)
export const voteReview = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Review voting initiated", {
      requestId,
      userId: req.user.id,
      reviewId: req.params.reviewId,
      vote: req.body.vote
    });
    
    // Validate vote value
    const vote = req.body.vote;
    if (vote !== 1 && vote !== -1) {
      logWarn("Review voting failed - invalid vote value", {
        requestId,
        userId: req.user.id,
        reviewId: req.params.reviewId,
        vote
      });
      
      return sendResponse(
        res,
        400,
        false,
        "Invalid vote value. Please use 1 for helpful or -1 for not helpful.",
        null,
        requestId
      );
    }
    
    // Check if review exists
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
        "Review not found. It may have been deleted.",
        null,
        requestId
      );
    }
    
    // Check if user has already voted
    const existingVoteIndex = review.userVotes.findIndex(v => v.user.toString() === req.user.id);
    
    if (existingVoteIndex > -1) {
      // Update existing vote
      review.userVotes[existingVoteIndex].vote = vote;
    } else {
      // Add new vote
      review.userVotes.push({
        user: req.user.id,
        vote
      });
    }
    
    // Recalculate helpful votes
    review.helpfulVotes = review.userVotes.reduce((total, vote) => total + vote.vote, 0);
    
    await review.save();
    
    logInfo("Review vote recorded successfully", {
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
      "Something went wrong while recording your vote. Please try again later.",
      null,
      requestId
    );
  }
};