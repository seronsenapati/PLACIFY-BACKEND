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
// Define sub-schema for About section (REMOVED openToRoles)
const aboutSchema = new mongoose.Schema(
  {
    gender: { type: String, required: true },
    location: { type: String, required: true },
    primaryRole: { type: String, required: true },
    experience: { type: Number, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["student", "recruiter", "admin"],
      default: "student",
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    resume: {
      type: String,
      default: null,
    },
    bookmarkedJobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
      },
    ],
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
    
    // Notification preferences
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({})
    },
  },
  { timestamps: true }
);

// Add index for better performance on bookmarkedJobs queries
// Only create index in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.CREATE_INDEXES === 'true') {
  userSchema.index({ bookmarkedJobs: 1 }, { background: true });
  userSchema.index({ company: 1 }, { background: true });
}

const User = mongoose.model("User", userSchema);

export default User;