import mongoose from "mongoose";

// Define sub-schema for Education entries
const educationSchema = new mongoose.Schema({
  school: { type: String, required: true },
  degree: { type: String, required: true },
  fromYear: { type: Number, required: true },
  toYear: { type: Number, required: true },
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
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
