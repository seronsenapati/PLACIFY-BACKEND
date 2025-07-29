import mongoose from "mongoose";

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
      enum: ["pending", "reviewed", "rejected"],
      default: "pending",
    },
    resumeUrl: {
      type: String, // Cloudinary URL will be stored here
    },
  },
  { timestamps: true }
);

const Application = mongoose.model("Application", applicationSchema);

export default Application;
