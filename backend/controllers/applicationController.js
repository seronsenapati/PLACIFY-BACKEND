// controllers/applicationController.js
// Handles status updates for job applications

import mongoose from "mongoose";
import Application from "../models/Application.js";
import Notification from "../models/Notification.js";
import sendResponse from "../utils/sendResponse.js";

// Allowed status values for application updates
const ALLOWED_STATUSES = ["reviewed", "rejected"];

/**
 * @desc Update application status (by recruiter)
 * @route PATCH /api/applications/:id
 * @access Recruiter (only for their own job postings)
 */
export const updateApplicationStatus = async (req, res) => {
  const { id: applicationId } = req.params;
  const { status } = req.body;

  // ✅ Validate status value
  if (!ALLOWED_STATUSES.includes(status)) {
    return sendResponse(res, 400, false, "Invalid status value");
  }

  // ✅ Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return sendResponse(res, 400, false, "Invalid application ID");
  }

  try {
    // ✅ Fetch application with job details
    const application = await Application.findById(applicationId).populate(
      "job"
    );

    if (!application) {
      return sendResponse(res, 404, false, "Application not found");
    }

    const job = application.job;

    // ✅ Ensure recruiter owns the job
    if (job.createdBy.toString() !== req.user.id.toString()) {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to update this application"
      );
    }

    // ✅ Update and save new application status
    application.status = status;
    await application.save();

    // ✅ Create notification for student
    await Notification.create({
      user: application.student,
      message: `Your application for ${job.title} has been ${status}`,
    });

    return sendResponse(
      res,
      200,
      true,
      "Application status updated successfully",
      application
    );
  } catch (error) {
    console.error("❌ Application status update error:", error);
    return sendResponse(
      res,
      500,
      false,
      "Server error while updating application status"
    );
  }
};
