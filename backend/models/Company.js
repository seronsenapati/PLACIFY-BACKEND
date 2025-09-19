import mongoose from "mongoose";
import Review from "./Review.js";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      minlength: [2, "Company name must be at least 2 characters"],
      maxlength: [100, "Company name cannot exceed 100 characters"],
      // Add unique constraint to prevent duplicate company names
      unique: true,
      trim: true
    },
    desc: {
      type: String,
      required: [true, "Company description is required"],
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    website: {
      type: String,
      required: [true, "Company website is required"],
      match: [
        /^(https?:\/\/)?([\w\-]+\.)+[a-z]{2,}(:\d{1,5})?(\/.*)?$/i,
        "Please enter a valid website URL",
      ],
    },
    logo: {
      type: String,
      default: null, // Cloudinary URL
    },
    // Add location field for better searchability
    location: {
      type: String,
      trim: true
    },
    // Add industry field for better categorization
    industry: {
      type: String,
      trim: true,
      enum: [
        "Technology", 
        "Finance", 
        "Healthcare", 
        "Education", 
        "Manufacturing", 
        "Retail", 
        "Hospitality",
        "Transportation",
        "Media",
        "Entertainment",
        "Real Estate",
        "Energy",
        "Telecommunications",
        "Agriculture",
        "Government",
        "Non-profit",
        "Other"
      ]
    },
    // Add company size field
    size: {
      type: String,
      enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
      default: "1-10"
    },
    // Add employee count field
    employeeCount: {
      type: Number,
      min: [0, "Employee count cannot be negative"]
    },
    // Add social media links
    socialMedia: {
      linkedin: String,
      twitter: String,
      facebook: String,
      instagram: String
    },
    // Add verification status
    isVerified: {
      type: Boolean,
      default: false
    },
    // Add profile completeness percentage
    profileCompleteness: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    // Add rating information
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    // Add activity tracking
    activityLog: [
      {
        action: {
          type: String,
          required: true,
          enum: [
            "created",
            "updated",
            "logo_updated",
            "job_posted",
            "job_updated",
            "job_deleted",
            "review_added",
            "review_updated",
            "review_deleted"
          ]
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        details: {
          type: mongoose.Schema.Types.Mixed
        }
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"],
    },
    jobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
      },
    ],
  },
  { timestamps: true }
);

// Add indexes for better performance on common queries
// Only create indexes in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.CREATE_INDEXES === 'true') {
  companySchema.index({ name: 1 }, { background: true });
  companySchema.index({ location: 1 }, { background: true });
  companySchema.index({ industry: 1 }, { background: true });
  companySchema.index({ isVerified: 1 }, { background: true });
  companySchema.index({ createdAt: -1 }, { background: true });
  companySchema.index({ profileCompleteness: -1 }, { background: true });
  companySchema.index({ averageRating: -1 }, { background: true });
  companySchema.index({ "activityLog.timestamp": -1 }, { background: true });
}

// Ensure indexes are created in development as well for testing
companySchema.index({ name: 1 });

// Static method to get company statistics
companySchema.statics.getStats = async function() {
  const total = await this.countDocuments();
  
  // Count companies with active jobs
  const companiesWithJobs = await this.aggregate([
    {
      $lookup: {
        from: "jobs",
        localField: "jobs",
        foreignField: "_id",
        as: "activeJobs"
      }
    },
    {
      $match: {
        "activeJobs.0": { $exists: true }
      }
    },
    {
      $count: "count"
    }
  ]);
  
  const active = companiesWithJobs.length > 0 ? companiesWithJobs[0].count : 0;
  
  // Count verified companies
  const verified = await this.countDocuments({ isVerified: true });
  
  return {
    total,
    active,
    verified
  };
};

// Static method to get company analytics
companySchema.statics.getAnalytics = async function() {
  // Get companies by industry
  const byIndustry = await this.aggregate([
    {
      $group: {
        _id: "$industry",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  // Get companies by size
  const bySize = await this.aggregate([
    {
      $group: {
        _id: "$size",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  // Get companies by verification status
  const byVerification = await this.aggregate([
    {
      $group: {
        _id: "$isVerified",
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Get companies by creation date (monthly)
  const byMonth = await this.aggregate([
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);
  
  // Get average profile completeness
  const avgCompleteness = await this.aggregate([
    {
      $group: {
        _id: null,
        average: { $avg: "$profileCompleteness" }
      }
    }
  ]);
  
  // Get companies by rating
  const byRating = await this.aggregate([
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lt: ["$averageRating", 2] }, then: "0-2" },
              { case: { $lt: ["$averageRating", 3] }, then: "2-3" },
              { case: { $lt: ["$averageRating", 4] }, then: "3-4" },
              { case: { $lte: ["$averageRating", 5] }, then: "4-5" }
            ],
            default: "0-2"
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    byIndustry,
    bySize,
    byVerification,
    byMonth,
    byRating,
    avgProfileCompleteness: avgCompleteness.length > 0 ? Math.round(avgCompleteness[0].average) : 0
  };
};

// Instance method to calculate profile completeness
companySchema.methods.calculateProfileCompleteness = function() {
  let completeness = 0;
  const requiredFields = ['name', 'desc', 'website'];
  const optionalFields = ['location', 'industry', 'logo', 'socialMedia'];
  
  // Check required fields
  requiredFields.forEach(field => {
    if (this[field] && this[field].length > 0) {
      completeness += 20; // 20% for each required field
    }
  });
  
  // Check optional fields
  optionalFields.forEach(field => {
    if (field === 'socialMedia') {
      // Check if any social media link is provided
      if (this[field] && 
          (this[field].linkedin || this[field].twitter || 
           this[field].facebook || this[field].instagram)) {
        completeness += 5; // 5% for social media
      }
    } else if (this[field] && this[field].length > 0) {
      completeness += 5; // 5% for each optional field
    }
  });
  
  // Cap at 100%
  this.profileCompleteness = Math.min(completeness, 100);
  return this.profileCompleteness;
};

// Instance method to get detailed profile completion information
companySchema.methods.getProfileCompletionDetails = function() {
  return {
    requiredFields: {
      name: {
        completed: !!(this.name && this.name.length > 0),
        weight: 20
      },
      description: {
        completed: !!(this.desc && this.desc.length > 0),
        weight: 20
      },
      website: {
        completed: !!(this.website && this.website.length > 0),
        weight: 20
      }
    },
    optionalFields: {
      location: {
        completed: !!(this.location && this.location.length > 0),
        weight: 5
      },
      industry: {
        completed: !!(this.industry && this.industry.length > 0),
        weight: 5
      },
      logo: {
        completed: !!(this.logo && this.logo.length > 0),
        weight: 5
      },
      socialMedia: {
        completed: !!(this.socialMedia &&
          (this.socialMedia.linkedin ||
           this.socialMedia.twitter ||
           this.socialMedia.facebook ||
           this.socialMedia.instagram)),
        weight: 5
      }
    }
  };
};

// Instance method to update rating information
companySchema.methods.updateRating = async function() {
  const ratingInfo = await Review.getAverageRating(this._id);
  this.averageRating = ratingInfo.average;
  this.reviewCount = ratingInfo.count;
  await this.save();
};

// Instance method to log activity
companySchema.methods.logActivity = function(action, userId, details = null) {
  this.activityLog.push({
    action,
    user: userId,
    timestamp: new Date(),
    details
  });
  
  // Keep only the last 50 activities to prevent document size from growing too large
  if (this.activityLog.length > 50) {
    this.activityLog = this.activityLog.slice(-50);
  }
  
  return this.save();
};

// Pre-save middleware to calculate profile completeness
companySchema.pre('save', function(next) {
  this.calculateProfileCompleteness();
  next();
});

const Company = mongoose.model("Company", companySchema);
export default Company;