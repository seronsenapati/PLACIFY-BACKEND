import mongoose from "mongoose";
import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

// GET /api/applications/student
export const getStudentApplications = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return sendResponse(
        res,
        403,
        false,
        "Access denied. Only students can view their applications."
      );
    }

    // Optional: validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return sendResponse(res, 400, false, "Invalid student ID");
    }

    // Optional: pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const applications = await Application.find({
      student: req.user.id,
    })
      .populate({
        path: "job",
        populate: {
          path: "createdBy",
          select: "name email", // Recruiter info
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Application.countDocuments({ student: req.user.id });

    return sendResponse(res, 200, true, "Applications fetched successfully", {
      applications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch Student Applications Error:", error);
    if (error.name === "CastError") {
      return sendResponse(res, 400, false, "Invalid user ID");
    }
    return sendResponse(res, 500, false, "Server error");
  }
};
