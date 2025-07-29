import Application from "../models/Application.js";
import Notification from "../models/Notification.js";
import sendResponse from "../utils/sendResponse.js";

export const updateApplicationStatus = async (req, res) => {
  const applicationId = req.params.id;
  const { status } = req.body;

  if (!["reviewed", "rejected"].includes(status)) {
    return sendResponse(res, 400, false, "Invalid status value");
  }

  try {
    const application = await Application.findById(applicationId).populate(
      "job"
    );

    if (!application) {
      return sendResponse(res, 404, false, "Application not found");
    }

    const job = application.job;

    if (job.createdBy.toString() !== req.user.id.toString()) {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to update this application"
      );
    }

    application.status = status;
    await application.save();

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
    return sendResponse(res, 500, false, "Server error");
  }
};
