import Notification from "../models/Notification.js";
import sendResponse from "../utils/sendResponse.js";

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Improved: safer limit parsing
    const rawLimit = parseInt(req.query.limit);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 20;

    const unreadOnly = req.query.unread === "true";

    const filter = { user: userId };  // Changed from 'recipient' to 'user' to match the model
    if (unreadOnly) {
      filter.read = false;  // Changed from 'isRead' to 'read' to match the model
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return sendResponse(
      res,
      200,
      true,
      "Notifications fetched successfully",
      notifications
    );
  } catch (error) {
    console.error("🔴 [Notification Fetch Error]:", error.message);
    return sendResponse(res, 500, false, "Failed to fetch notifications");
  }
};

// PATCH /api/notifications/mark-read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { user: userId, read: false },
      { $set: { read: true } }
    );

    // Improved: only return modifiedCount
    return sendResponse(res, 200, true, "Notifications marked as read", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("🔴 [Mark Notifications Read Error]:", error.message);
    return sendResponse(
      res,
      500,
      false,
      "Failed to mark notifications as read"
    );
  }
};

// DELETE /api/notifications
export const deleteNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.deleteMany({ recipient: userId });

    // Improved: only return deletedCount
    return sendResponse(res, 200, true, "Notifications deleted successfully", {
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("🔴 [Delete Notifications Error]:", error.message);
    return sendResponse(res, 500, false, "Failed to delete notifications");
  }
};
