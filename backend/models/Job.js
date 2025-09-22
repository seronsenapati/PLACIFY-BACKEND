import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    desc: {
      type: String,
      required: true,
      minlength: 20,
      maxlength: 2000,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    salary: {
      type: Number,
      required: true,
      min: [0, "Salary cannot be negative"],
    },
    skills: {
      type: [String],
      required: true,
      validate: [
        {
          validator: function (arr) {
            return arr.length > 0 && arr.length <= 20;
          },
          message: "Please provide at least one and at most 20 skills",
        },
      ],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jobType: {
      type: String,
      enum: ["internship", "full-time", "part-time", "contract"],
      default: "internship",
    },
    // Add expiration date for job postings
    expiresAt: {
      type: Date,
      index: true
    },
    // Add status field for job postings
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "active",
      index: true
    },
    // Add application deadline
    applicationDeadline: {
      type: Date,
      validate: {
        validator: function(deadline) {
          return !deadline || (this.expiresAt && deadline <= this.expiresAt);
        },
        message: "Application deadline must be before or equal to job expiration date"
      }
    },
    // Add experience level
    experienceLevel: {
      type: String,
      enum: ["entry", "mid", "senior", "lead"],
      default: "entry"
    },
    // Add remote work option
    isRemote: {
      type: Boolean,
      default: false
    },
    // Add company reference
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true
    }
  },
  { timestamps: true }
);

// Add indexes for better performance on common queries
// Create indexes in both development and production for consistent performance
jobSchema.index({ createdBy: 1 });
jobSchema.index({ location: 1, jobType: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ expiresAt: 1, status: 1 });
// Add new indexes for enhanced search capabilities
jobSchema.index({ company: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ isRemote: 1 });
jobSchema.index({ applicationDeadline: 1 });
jobSchema.index({ title: "text", role: "text", location: "text" }); // Text index for search

// Static method to get job statistics
jobSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    active: 0,
    inactive: 0,
    expired: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

// Static method to get job statistics by recruiter
jobSchema.statics.getStatsByRecruiter = async function(recruiterId) {
  const stats = await this.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(recruiterId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    active: 0,
    inactive: 0,
    expired: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

// Static method to get detailed job statistics by recruiter
jobSchema.statics.getDetailedStatsByRecruiter = async function(recruiterId) {
  const stats = await this.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(recruiterId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        remoteJobs: {
          $sum: {
            $cond: [{ $eq: ['$isRemote', true] }, 1, 0]
          }
        },
        jobsByType: {
          $push: '$jobType'
        },
        jobsByExperience: {
          $push: '$experienceLevel'
        }
      }
    }
  ]);
  
  const result = {
    total: 0,
    active: 0,
    inactive: 0,
    expired: 0,
    remoteJobs: 0,
    byType: {},
    byExperience: {}
  };
  
  // Initialize job type counts
  const jobTypes = ["internship", "full-time", "part-time", "contract"];
  jobTypes.forEach(type => {
    result.byType[type] = 0;
  });
  
  // Initialize experience level counts
  const experienceLevels = ["entry", "mid", "senior", "lead"];
  experienceLevels.forEach(level => {
    result.byExperience[level] = 0;
  });
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    result.remoteJobs += stat.remoteJobs;
    
    // Count jobs by type
    stat.jobsByType.forEach(type => {
      if (result.byType[type] !== undefined) {
        result.byType[type] += 1;
      }
    });
    
    // Count jobs by experience level
    stat.jobsByExperience.forEach(level => {
      if (result.byExperience[level] !== undefined) {
        result.byExperience[level] += 1;
      }
    });
  });
  
  return result;
};

// Static method to get jobs expiring soon for a recruiter
jobSchema.statics.getExpiringSoonByRecruiter = async function(recruiterId, days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);
  
  const expiringJobs = await this.find({
    createdBy: new mongoose.Types.ObjectId(recruiterId),
    status: 'active',
    expiresAt: {
      $gte: new Date(),
      $lte: cutoffDate
    }
  }).select('_id title expiresAt applicationDeadline');
  
  return expiringJobs.map(job => ({
    id: job._id,
    title: job.title,
    expiresAt: job.expiresAt,
    applicationDeadline: job.applicationDeadline,
    daysUntilExpiration: Math.ceil((job.expiresAt - new Date()) / (1000 * 60 * 60 * 24))
  }));
};

// Instance method to check if job is expiring soon
jobSchema.methods.isExpiringSoon = function(notificationDays) {
  if (!this.expiresAt) return false;
  
  const notificationDate = new Date(this.expiresAt);
  notificationDate.setDate(notificationDate.getDate() - (notificationDays || 3));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  notificationDate.setHours(0, 0, 0, 0);
  
  return today.getTime() === notificationDate.getTime();
};

// Instance method to check if job is expired
jobSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expireDate = new Date(this.expiresAt);
  expireDate.setHours(0, 0, 0, 0);
  
  return today.getTime() > expireDate.getTime();
};

const Job = mongoose.model("Job", jobSchema);
export default Job;