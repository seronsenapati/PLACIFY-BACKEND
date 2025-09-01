import mongoose from "mongoose";

// Status history sub-schema
const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["pending", "reviewed", "rejected", "withdrawn"],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reason: {
    type: String,
    maxlength: 500
  }
}, { _id: false });

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "rejected", "withdrawn"],
      default: "pending",
    },
    resumeUrl: {
      type: String,
      required: true
    },
    resumeFileName: {
      type: String
    },
    resumeFileSize: {
      type: Number
    },
    coverLetter: {
      type: String,
      maxlength: 2000
    },
    statusHistory: [statusHistorySchema],
    withdrawnAt: {
      type: Date
    },
    withdrawalReason: {
      type: String,
      maxlength: 500
    },
    reviewedAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      source: {
        type: String,
        enum: ["web", "mobile", "api"],
        default: "web"
      }
    }
  },
  { timestamps: true }
);

// Prevent duplicate applications for same job by same student
applicationSchema.index({ job: 1, student: 1 }, { unique: true });

// Index for efficient queries
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ student: 1, createdAt: -1 });
applicationSchema.index({ job: 1, status: 1 });

// Pre-save middleware to track status changes
applicationSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    // Add to status history
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this._statusUpdatedBy || this.student
    });
    
    // Update specific date fields
    if (this.status === 'reviewed') {
      this.reviewedAt = new Date();
    } else if (this.status === 'rejected') {
      this.rejectedAt = new Date();
    } else if (this.status === 'withdrawn') {
      this.withdrawnAt = new Date();
    }
  }
  
  next();
});

// Instance method to check if application can be withdrawn
applicationSchema.methods.canWithdraw = function() {
  return this.status === 'pending';
};

// Instance method to withdraw application
applicationSchema.methods.withdraw = function(reason = '') {
  if (!this.canWithdraw()) {
    throw new Error('Application cannot be withdrawn at this stage');
  }
  
  this.status = 'withdrawn';
  this.withdrawalReason = reason;
  this._statusUpdatedBy = this.student;
  return this.save();
};

// Static method to get application statistics
applicationSchema.statics.getStatsByJob = async function(jobId) {
  const stats = await this.aggregate([
    { $match: { job: new mongoose.Types.ObjectId(jobId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    pending: 0,
    reviewed: 0,
    rejected: 0,
    withdrawn: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

// Static method to get application statistics by student
applicationSchema.statics.getStatsByStudent = async function(studentId) {
  const stats = await this.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    pending: 0,
    reviewed: 0,
    rejected: 0,
    withdrawn: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

const Application = mongoose.model("Application", applicationSchema);

export default Application;
