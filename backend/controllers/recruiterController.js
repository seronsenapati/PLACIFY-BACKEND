import Job from "../models/Job.js";
import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

export const getRecruiterDashboard = async (req, res) => {
  try {
    const recruiterId = req.user.id;

    const jobs = await Job.find({ createdBy: recruiterId }).lean();
    const jobIds = jobs.map((job) => job._id);

    const applicationCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: "$job", count: { $sum: 1 } } },
    ]);

    const appCountMap = new Map();
    applicationCounts.forEach((entry) => {
      appCountMap.set(entry._id.toString(), entry.count);
    });

    const applicationsPerJob = jobs.map((job) => ({
      title: job.title,
      applications: appCountMap.get(job._id.toString()) || 0,
    }));

    const totalApplications = applicationCounts.reduce(
      (sum, job) => sum + job.count,
      0
    );

    applicationsPerJob.sort((a, b) => b.applications - a.applications);
    const mostAppliedJob = applicationsPerJob[0] || null;

    return sendResponse(res, 200, true, "Recruiter dashboard fetched", {
      totalJobs: jobs.length,
      totalApplications,
      mostAppliedJob,
      applicationsPerJob,
    });
  } catch (error) {
    console.error("🔴 Recruiter Dashboard Error:", error.message);
    return sendResponse(res, 500, false, "Server error");
  }
};
