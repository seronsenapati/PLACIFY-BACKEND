// controllers/adminController.js
// Admin-only controller for managing users, stats, and cleanup operations

import mongoose from "mongoose";
import User from "../models/User.js";
import Job from "../models/Job.js";
import Company from "../models/Company.js";
import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

/**
 * @desc Get all registered users (excluding sensitive fields)
 * @route GET /api/admin/users
 * @access Admin
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password -__v").lean();
    return sendResponse(res, 200, true, "Users retrieved successfully", users);
  } catch (error) {
    console.error("Get All Users Error:", error);
    return sendResponse(res, 500, false, "Server error while fetching users");
  }
};

/**
 * @desc Toggle a user's active status (activate/deactivate)
 * @route PATCH /api/admin/users/:userId/status
 * @access Admin
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendResponse(res, 400, false, "Invalid user ID");
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user.id) {
      return sendResponse(
        res,
        400,
        false,
        "Cannot deactivate your own account"
      );
    }

    user.isActive = !user.isActive;
    await user.save();

    return sendResponse(
      res,
      200,
      true,
      `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      { userId: user._id, isActive: user.isActive }
    );
  } catch (error) {
    console.error("Toggle User Status Error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Server error while updating user status"
    );
  }
};

/**
 * @desc Delete a user and associated data (jobs, companies, applications)
 * @route DELETE /api/admin/users/:userId
 * @access Admin
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if userId is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendResponse(res, 400, false, "Invalid user ID");
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return sendResponse(res, 400, false, "Cannot delete your own account");
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Clean up related data
    await Promise.all([
      Job.deleteMany({ createdBy: userId }),
      Company.deleteMany({ createdBy: userId }),
      Application.deleteMany({
        $or: [{ student: userId }, { recruiter: userId }],
      }),
    ]);

    return sendResponse(res, 200, true, "User deleted successfully");
  } catch (error) {
    console.error("Delete User Error:", error);
    return sendResponse(res, 500, false, "Server error while deleting user");
  }
};

/**
 * @desc Get system-wide stats: total users, jobs, companies, and applications
 * @route GET /api/admin/stats
 * @access Admin
 */
export const getSystemStats = async (req, res) => {
  try {
    const [userCounts, jobs, companies, applications] = await Promise.all([
      // Aggregating user stats in a single query
      User.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ]),
      Job.countDocuments(),
      Company.countDocuments(),
      Application.countDocuments(),
    ]);

    const userStats = {
      total: userCounts.reduce((acc, curr) => acc + curr.count, 0),
      students: userCounts.find((u) => u._id === "student")?.count || 0,
      recruiters: userCounts.find((u) => u._id === "recruiter")?.count || 0,
      admins: userCounts.find((u) => u._id === "admin")?.count || 0,
      active: await User.countDocuments({ isActive: true }),
    };

    const stats = {
      users: userStats,
      jobs: {
        total: jobs,
        active: await Job.countDocuments({ isActive: true }),
      },
      companies,
      applications,
    };

    return sendResponse(
      res,
      200,
      true,
      "System stats retrieved successfully",
      stats
    );
  } catch (error) {
    console.error("Get System Stats Error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Server error while fetching system stats"
    );
  }
};
