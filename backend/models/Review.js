import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5",
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // Verification status for the review
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Helpful votes for the review
    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Add indexes for better performance
// Only create indexes in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.CREATE_INDEXES === 'true') {
  reviewSchema.index({ company: 1, createdAt: -1 }, { background: true });
  reviewSchema.index({ user: 1 }, { background: true });
  reviewSchema.index({ rating: 1 }, { background: true });
  reviewSchema.index({ isVerified: 1 }, { background: true });
}

// Ensure a user can only review a company once
reviewSchema.index({ company: 1, user: 1 }, { unique: true });

// Static method to get average rating for a company
reviewSchema.statics.getAverageRating = async function(companyId) {
  const result = await this.aggregate([
    {
      $match: { company: new mongoose.Types.ObjectId(companyId) }
    },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? {
    average: Math.round(result[0].average * 10) / 10, // Round to 1 decimal place
    count: result[0].count
  } : { average: 0, count: 0 };
};

// Static method to get company reviews with user details
reviewSchema.statics.getReviewsWithUsers = async function(companyId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  return await this.aggregate([
    {
      $match: { company: new mongoose.Types.ObjectId(companyId) }
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userDetails"
      }
    },
    {
      $unwind: "$userDetails"
    },
    {
      $project: {
        rating: 1,
        title: 1,
        comment: 1,
        isVerified: 1,
        helpfulVotes: 1,
        createdAt: 1,
        "userDetails.name": 1,
        "userDetails.profilePhoto": 1,
        "userDetails.role": 1
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $skip: skip
    },
    {
      $limit: limit
    }
  ]);
};

const Review = mongoose.model("Review", reviewSchema);
export default Review;