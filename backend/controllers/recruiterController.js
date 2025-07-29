import Job from "../models/Job.js";
import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

export const getRecruiterDashboard = async (req, res) => {
  try {
    const recruiterId = req.user.id;

    const jobs = await Job.find({ createdBy: recruiterId });

    const totalJobs = jobs.length;

    let totalApplications = 0;
    const applicationsPerJob = [];

    for (let job of jobs) {
      const count = await Application.countDocuments({ job: job._id });
      totalApplications += count;
      applicationsPerJob.push({
        title: job.title,
        applications: count,
      });
    }

    applicationsPerJob.sort((a, b) => b.applications - a.applications);
    const mostAppliedJob = applicationsPerJob[0] || null;

    return sendResponse(res, 200, true, "Recruiter dashboard fetched", {
      totalJobs,
      totalApplications,
      mostAppliedJob,
      applicationsPerJob,
    });
  } catch (error) {
    console.error("Recruiter Dashboard Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
