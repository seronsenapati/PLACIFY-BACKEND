import Notification from "../models/Notification.js";
import sendResponse from "../utils/sendResponse.js";
import mongoose from "mongoose";

export const getNotifications = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const notifications = await Notification.find({
      recipient: userId,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    return sendResponse(
      res,
      200,
      true,
      "Notifications fetched successfully",
      notifications
    );
  } catch (error) {
    console.error("❌ Notification Fetch Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
