import Job from "../models/Job.js";
import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

export const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
   
    const job = await Job.findById(jobId);
    if (!job) {
      return sendResponse(res, 404, false, "Job not found");
    }

    if (job.createdBy.toString() !== req.user.id) {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to view applications for this job"
      );
    }

    const applications = await Application.find({ job: jobId })
      .populate("student", "name email")
      .sort({ createdAt: -1 });

    return sendResponse(
      res,
      200,
      true,
      "Applications fetched successfully",
      applications
    );
  } catch (error) {
    console.error("Fetch Job Applications Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
