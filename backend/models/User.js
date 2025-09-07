import mongoose from "mongoose";

// Define sub-schema for Education entries
const educationSchema = new mongoose.Schema({
  school: { type: String, required: true },
  degree: { type: String, required: true },
  fromYear: { type: Number, required: true },
  toYear: { type: Number},
});

// Define sub-schema for Social Profiles
const socialProfilesSchema = new mongoose.Schema(
  {
    website: { type: String },
    linkedin: { type: String },
    github: { type: String },
    x: { type: String }, // X (Twitter)
    instagram: { type: String },
  },
  { _id: false }
);

// Define sub-schema for Notification Preferences
const notificationPreferencesSchema = new mongoose.Schema(
  {
    email: {
      enabled: { type: Boolean, default: true },
      types: {
        application_status: { type: Boolean, default: true },
        new_application: { type: Boolean, default: true },
        job_expiring: { type: Boolean, default: true },
        job_expired: { type: Boolean, default: true },
        system_message: { type: Boolean, default: true },
        account_update: { type: Boolean, default: false },
        payment_update: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true }
      }
    },
    push: {
      enabled: { type: Boolean, default: true },
      types: {
        application_status: { type: Boolean, default: true },
        new_application: { type: Boolean, default: true },
        job_expiring: { type: Boolean, default: false },
        job_expired: { type: Boolean, default: false },
        system_message: { type: Boolean, default: true },
        account_update: { type: Boolean, default: false },
        payment_update: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true }
      }
    },
    inApp: {
      enabled: { type: Boolean, default: true },
      types: {
        application_status: { type: Boolean, default: true },
        new_application: { type: Boolean, default: true },
        job_expiring: { type: Boolean, default: true },
        job_expired: { type: Boolean, default: true },
        system_message: { type: Boolean, default: true },
        account_update: { type: Boolean, default: true },
        payment_update: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true }
      }
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00" }, // 10 PM
      end: { type: String, default: "08:00" }, // 8 AM
      timezone: { type: String, default: "UTC" }
    }
  },
  { _id: false }
);

// Define sub-schema for Recruiter Settings
const recruiterSettingsSchema = new mongoose.Schema(
  {
    // Job creation defaults
    defaultJobExpirationDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365
    },
    defaultApplicationDeadlineDays: {
      type: Number,
      default: 14,
      min: 1,
      max: 365
    },
    // Notification preferences for job expiration
    notifyBeforeJobExpiration: {
      type: Boolean,
      default: true
    },
    jobExpirationNotificationDays: {
      type: Number,
      default: 3,
      min: 1,
      max: 30
    },
    // Application review settings
    autoReviewApplications: {
      type: Boolean,
      default: false
    },
    applicationReviewThreshold: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    // Dashboard preferences
    dashboardMetrics: {
      type: [String],
      default: () => [
        'totalJobs',
        'activeJobs',
        'expiredJobs',
        'totalApplications',
        'pendingApplications',
        'reviewedApplications',
        'rejectedApplications'
      ]
    },
    // Export preferences
    defaultExportFormat: {
      type: String,
      enum: ['csv', 'json'],
      default: 'csv'
    }
  },
  { _id: false }
);

// Define sub-schema for About section
const aboutSchema = new mongoose.Schema(
  {
    gender: { type: String },
    location: { type: String },
    primaryRole: { type: String },
    experience: { type: Number },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["student", "recruiter", "admin"],
      default: "student",
    },
    profilePhoto: { type: String },
    resume: { type: String },
    username: { type: String, unique: true },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    isActive: {
      type: Boolean,
      default: true,
    },

    // Student profile
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    about: aboutSchema,
    socialProfiles: socialProfilesSchema,
    education: [educationSchema],
    skills: [{ type: String }],

    // Recruiter only
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    recruiterSettings: {
      type: recruiterSettingsSchema,
      default: () => ({})
    },
    
    // Notification preferences
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({})
    },
    
    // Bookmarked jobs for students
    bookmarkedJobs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job"
    }]
  },
  { timestamps: true }
);

// Add index for better performance on bookmarkedJobs queries
// Only create index in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.CREATE_INDEXES === 'true') {
  userSchema.index({ bookmarkedJobs: 1 }, { background: true });
  userSchema.index({ company: 1 }, { background: true });
}

// Static method to get user statistics
userSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    students: 0,
    recruiters: 0,
    admins: 0
  };
  
  stats.forEach(stat => {
    if (stat._id === 'student') {
      result.students = stat.count;
    } else if (stat._id === 'recruiter') {
      result.recruiters = stat.count;
    } else if (stat._id === 'admin') {
      result.admins = stat.count;
    }
    result.total += stat.count;
  });
  
  return result;
};

const User = mongoose.model("User", userSchema);

export default User;