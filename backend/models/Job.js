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
    }
  },
  { timestamps: true }
);

// Add indexes for better performance on common queries
// Only create indexes in production or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.CREATE_INDEXES === 'true') {
  jobSchema.index({ createdBy: 1 }, { background: true });
  jobSchema.index({ location: 1, jobType: 1 }, { background: true });
  jobSchema.index({ skills: 1 }, { background: true });
  jobSchema.index({ createdAt: -1 }, { background: true });
  jobSchema.index({ expiresAt: 1, status: 1 }, { background: true });
}

const Job = mongoose.model("Job", jobSchema);
export default Job;