import User from "../models/User.js";
import Job from "../models/Job.js";
import sendResponse from "../utils/sendResponse.js";
import { logInfo, logError } from "../utils/logger.js";

// POST /api/bookmarks/:jobId
export const bookmarkJob = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      logWarn("Non-student user attempted to bookmark job", {
        userId: req.user._id,
        role: req.user.role,
        jobId: req.params.jobId
      });
      return sendResponse(res, 403, false, "Only students can bookmark jobs");
    }

    const { jobId } = req.params;
    
    logInfo("Attempting to bookmark job", {
      userId: req.user._id,
      jobId
    });
    
    // Validate job exists
    const job = await Job.findById(jobId);
    if (!job) {
      logWarn("Job not found when attempting to bookmark", {
        userId: req.user._id,
        jobId
      });
      return sendResponse(res, 404, false, "Job not found");
    }

    const user = await User.findById(req.user._id);

    // Check if already bookmarked
    const alreadyBookmarked = user.bookmarkedJobs.some((id) =>
      id.equals(jobId)
    );
    if (alreadyBookmarked) {
      logWarn("Job already bookmarked", {
        userId: req.user._id,
        jobId
      });
      return sendResponse(res, 400, false, "Job already bookmarked");
    }

    user.bookmarkedJobs.push(jobId);
    await user.save();
    
    logInfo("Job bookmarked successfully", {
      userId: req.user._id,
      jobId
    });

    return sendResponse(res, 200, true, "Job bookmarked successfully");
  } catch (error) {
    logError("Error bookmarking job", error, {
      userId: req.user._id,
      jobId: req.params.jobId
    });
    return sendResponse(res, 500, false, "Internal server error");
  }
};

// GET /api/bookmarks
export const getBookmarkedJobs = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      logWarn("Non-student user attempted to get bookmarked jobs", {
        userId: req.user._id,
        role: req.user.role
      });
      return sendResponse(
        res,
        403,
        false,
        "Only students can view bookmarked jobs"
      );
    }

    logInfo("Fetching bookmarked jobs", {
      userId: req.user._id
    });

    const user = await User.findById(req.user._id).populate({
      path: "bookmarkedJobs",
      populate: {
        path: "createdBy",
        select: "name email profilePhoto",
      },
    });

    // Return empty array if no bookmarks exist
    const bookmarkedJobs = user.bookmarkedJobs || [];
    
    logInfo("Bookmarked jobs retrieved successfully", {
      userId: req.user._id,
      count: bookmarkedJobs.length
    });
    
    return sendResponse(
      res,
      200,
      true,
      "Bookmarked jobs retrieved successfully",
      bookmarkedJobs
    );
  } catch (error) {
    logError("Error retrieving bookmarked jobs", error, {
      userId: req.user._id
    });
    return sendResponse(res, 500, false, "Server error");
  }
};

// GET /api/bookmarks/check/:jobId - Check if a job is bookmarked
export const checkIfBookmarked = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      logWarn("Non-student user attempted to check bookmark status", {
        userId: req.user._id,
        role: req.user.role,
        jobId: req.params.jobId
      });
      return sendResponse(
        res,
        403,
        false,
        "Only students can check bookmarked jobs"
      );
    }

    const { jobId } = req.params;
    
    logInfo("Checking bookmark status", {
      userId: req.user._id,
      jobId
    });
    
    // Validate job exists
    const job = await Job.findById(jobId);
    if (!job) {
      logWarn("Job not found when checking bookmark status", {
        userId: req.user._id,
        jobId
      });
      return sendResponse(res, 404, false, "Job not found");
    }

    const user = await User.findById(req.user._id);
    
    // Check if job is bookmarked
    const isBookmarked = user.bookmarkedJobs.some((id) => id.equals(jobId));
    
    logInfo("Bookmark status retrieved successfully", {
      userId: req.user._id,
      jobId,
      isBookmarked
    });
    
    return sendResponse(
      res,
      200,
      true,
      "Bookmark status retrieved successfully",
      { isBookmarked }
    );
  } catch (error) {
    logError("Error checking bookmark status", error, {
      userId: req.user._id,
      jobId: req.params.jobId
    });
    return sendResponse(res, 500, false, "Server error");
  }
};

// DELETE /api/bookmarks/:jobId
export const unbookmarkJob = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      logWarn("Non-student user attempted to unbookmark job", {
        userId: req.user._id,
        role: req.user.role,
        jobId: req.params.jobId
      });
      return sendResponse(res, 403, false, "Only students can unbookmark jobs");
    }

    const { jobId } = req.params;
    
    logInfo("Attempting to unbookmark job", {
      userId: req.user._id,
      jobId
    });
    
    // Validate job exists
    const job = await Job.findById(jobId);
    if (!job) {
      logWarn("Job not found when attempting to unbookmark", {
        userId: req.user._id,
        jobId
      });
      return sendResponse(res, 404, false, "Job not found");
    }

    const user = await User.findById(req.user._id);

    // Check if job is actually bookmarked
    const isBookmarked = user.bookmarkedJobs.some((id) => id.equals(jobId));
    if (!isBookmarked) {
      logWarn("Job is not bookmarked when attempting to unbookmark", {
        userId: req.user._id,
        jobId
      });
      return sendResponse(res, 400, false, "Job is not bookmarked");
    }

    // Remove the bookmark
    user.bookmarkedJobs = user.bookmarkedJobs.filter((id) => !id.equals(jobId));
    await user.save();
    
    logInfo("Job unbookmarked successfully", {
      userId: req.user._id,
      jobId
    });

    return sendResponse(res, 200, true, "Job unbookmarked successfully");
  } catch (error) {
    logError("Error unbookmarking job", error, {
      userId: req.user._id,
      jobId: req.params.jobId
    });
    return sendResponse(res, 500, false, "Internal server error");
  }
};