import Application from "../models/Application.js";
import sendResponse from "../utils/sendResponse.js";

export const getUserApplications = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id !== id && req.user.role !== "admin") {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to view these applications"
      );
    }

    const applications = await Application.find({ student: id })
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
      "User applications fetched successfully",
      applications
    );
  } catch (error) {
    console.error("User Applications Fetch Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
