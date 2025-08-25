import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import sendResponse from "../utils/sendResponse.js";
import User from "../models/User.js";
import Job from "../models/Job.js"; // ✅ required for checkJobOwnership

dotenv.config();

// Middleware to protect routes
export const protect = async (req, res, next) => {
  try {
    // ✅ Read token from cookies OR Authorization header
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return sendResponse(res, 401, false, "No token, authorization denied");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return sendResponse(res, 401, false, "User not found");
    }

    if (!user.isActive) {
      return sendResponse(res, 403, false, "This account has been deactivated");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return sendResponse(res, 401, false, "Session expired. Please login again.");
    }

    return sendResponse(res, 401, false, "Invalid or expired token");
  }
};

// Middleware to restrict access to certain roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendResponse(
        res,
        403,
        false,
        "You do not have permission to perform this action"
      );
    }
    next();
  };
};

// Middleware to verify job ownership
export const checkJobOwnership = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return sendResponse(res, 404, false, "Job not found");
    }

    if (req.user.role === "admin") {
      req.job = job;
      return next();
    }

    if (job.createdBy.toString() !== req.user._id.toString()) {
      return sendResponse(
        res,
        403,
        false,
        "Not authorized to perform this action on this job"
      );
    }

    req.job = job;
    next();
  } catch (error) {
    console.error("Job ownership check error:", error.message);
    return sendResponse(
      res,
      500,
      false,
      "Server error during job ownership verification"
    );
  }
};

export default protect;
