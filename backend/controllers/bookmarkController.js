import User from "../models/User.js";
import Job from "../models/Job.js";
import sendResponse from "../utils/sendResponse.js";

// POST /api/bookmarks/:jobId
export const bookmarkJob = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return sendResponse(res, 403, false, "Only students can bookmark jobs");
    }

    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      return sendResponse(res, 404, false, "Job not found");
    }

    const user = await User.findById(req.user.id); // or _id, depending on your token

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.bookmarkedJobs.includes(jobId)) {
      return sendResponse(res, 400, false, "Job already bookmarked");
    }

    user.bookmarkedJobs.push(jobId);
    await user.save();

    return sendResponse(res, 200, true, "Job bookmarked successfully");
  } catch (error) {
    console.error("Error bookmarking job:", error);
    return sendResponse(res, 500, false, "Internal server error");
  }
};

// GET /api/bookmarks
export const getBookmarkedJobs = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return sendResponse(
        res,
        403,
        false,
        "Only students can view bookmarked jobs"
      );
    }

    const user = await User.findById(req.user._id).populate({
      path: "bookmarkedJobs",
      populate: {
        path: "createdBy",
        select: "name email",
      },
    });

    return sendResponse(
      res,
      200,
      true,
      "Bookmarked jobs retrieved successfully",
      user.bookmarkedJobs
    );
  } catch (error) {
    console.error("Error retrieving bookmarked jobs:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
