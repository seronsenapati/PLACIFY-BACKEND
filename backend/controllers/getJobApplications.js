import mongoose from "mongoose";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

// GET /api/jobs/:jobId/applications
export const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Role check
    if (req.user.role !== "recruiter") {
      return sendResponse(res, 403, false, "Only recruiters can view job applications");
    }

    // Validate job ID format
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return sendResponse(res, 400, false, "Invalid job ID format");
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return sendResponse(res, 404, false, "Job not found");
    }

    // Ensure the logged-in recruiter owns this job
    if (job.createdBy.toString() !== req.user.id) {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to view applications for this job"
      );
    }

    // Optional: Pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const applications = await Application.find({ job: jobId })
      .populate("student", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Application.countDocuments({ job: jobId });

    return sendResponse(
      res,
      200,
      true,
      "Applications fetched successfully",
      {
        applications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      }
    );
  } catch (error) {
    console.error("Fetch Job Applications Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
