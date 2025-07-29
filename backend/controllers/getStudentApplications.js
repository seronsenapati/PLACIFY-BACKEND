import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

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

    const applications = await Application.find({
      student: req.user.id,
    })
      .populate({
        path: "job",
        populate: {
          path: "createdBy",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });

    return sendResponse(
      res,
      200,
      true,
      "Applications fetched successfully",
      applications
    );
  } catch (error) {
    console.error("Fetch Student Applications Error:", error);
    if (error.name === "CastError") {
      return sendResponse(res, 400, false, "Invalid user ID");
    }
    return sendResponse(res, 500, false, "Server error");
  }
};
