import Notification, { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from "../models/Notification.js";
import sendResponse from "../utils/sendResponse.js";
import { 
  getNotificationStats,
  markNotificationsAsRead,
  deleteNotificationsByCriteria,
  isValidNotificationType,
  isValidNotificationPriority
} from "../utils/notificationHelpers.js";
import mongoose from 'mongoose';

// GET /api/notifications - Enhanced with pagination, filtering, and search
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Parse query parameters
    const {
      page = 1,
      limit = 20,
      unread,
      type,
      priority,
      search,
      startDate,
      endDate
    } = req.query;

    // Validate and sanitize parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter = { user: userId };

    // Filter by read status
    if (unread === 'true') {
      filter.read = false;
    } else if (unread === 'false') {
      filter.read = true;
    }

    // Filter by type
    if (type && isValidNotificationType(type)) {
      filter.type = type;
    }

    // Filter by priority
    if (priority && isValidNotificationPriority(priority)) {
      filter.priority = priority;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (isNaN(startDateObj.getTime())) {
          return sendResponse(res, 400, false, "Invalid start date format. Please use YYYY-MM-DD format.");
        }
        filter.createdAt.$gte = startDateObj;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (isNaN(endDateObj.getTime())) {
          return sendResponse(res, 400, false, "Invalid end date format. Please use YYYY-MM-DD format.");
        }
        filter.createdAt.$lte = endDateObj;
      }
    }

    // Search in title and message
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { message: searchRegex }
      ];
    }

    // Execute queries in parallel
    const [notifications, totalCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const paginationData = {
      notifications,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage
      }
    };

    return sendResponse(
      res,
      200,
      true,
      "Notifications fetched successfully",
      paginationData
    );
  } catch (error) {
    console.error("🔴 [Notification Fetch Error]:", error.message);
    return sendResponse(res, 500, false, "Something went wrong while fetching your notifications. Please try again later.");
  }
};

// PATCH /api/notifications/mark-read - Mark all notifications as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, priority } = req.body;

    // Build criteria for marking as read
    const criteria = {};
    if (type && isValidNotificationType(type)) {
      criteria.type = type;
    }
    if (priority && isValidNotificationPriority(priority)) {
      criteria.priority = priority;
    }

    const result = await markNotificationsAsRead(userId, criteria);

    return sendResponse(res, 200, true, "Notifications marked as read", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("🔴 [Mark Notifications Read Error]:", error.message);
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while marking notifications as read. Please try again later."
    );
  }
};

// PATCH /api/notifications/:id/mark-read - Mark single notification as read
export const markSingleAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, "Invalid notification ID format. Please check the URL and try again.");
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return sendResponse(res, 404, false, "Notification not found. It may have been deleted.");
    }

    return sendResponse(res, 200, true, "Notification marked as read", notification);
  } catch (error) {
    console.error("🔴 [Mark Single Notification Read Error]:", error.message);
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while marking the notification as read. Please try again later."
    );
  }
};

// DELETE /api/notifications - Delete notifications with criteria
export const deleteNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ids, type, priority, read, olderThan } = req.body;

    let criteria = {};

    // Delete specific notifications by IDs
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Validate all IDs
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        return sendResponse(res, 400, false, "No valid notification IDs provided. Please check the IDs and try again.");
      }
      criteria._id = { $in: validIds };
    } else {
      // Build criteria for bulk deletion
      if (type && isValidNotificationType(type)) {
        criteria.type = type;
      }
      if (priority && isValidNotificationPriority(priority)) {
        criteria.priority = priority;
      }
      if (read !== undefined) {
        criteria.read = read;
      }
      if (olderThan) {
        const olderThanDate = new Date(olderThan);
        if (isNaN(olderThanDate.getTime())) {
          return sendResponse(res, 400, false, "Invalid date format for olderThan. Please use a valid date.");
        }
        criteria.createdAt = { $lt: olderThanDate };
      }
    }

    criteria.user = userId;

    const result = await deleteNotificationsByCriteria(criteria);

    return sendResponse(res, 200, true, "Notifications deleted successfully", {
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("🔴 [Delete Notifications Error]:", error.message);
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while deleting notifications. Please try again later."
    );
  }
};

// DELETE /api/notifications/:id - Delete a single notification
export const deleteSingleNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendResponse(res, 400, false, "Invalid notification ID format. Please check the URL and try again.");
    }

    const result = await Notification.deleteOne({ _id: id, user: userId });

    if (result.deletedCount === 0) {
      return sendResponse(res, 404, false, "Notification not found. It may have already been deleted.");
    }

    return sendResponse(res, 200, true, "Notification deleted successfully");
  } catch (error) {
    console.error("🔴 [Delete Single Notification Error]:", error.message);
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while deleting the notification. Please try again later."
    );
  }
};

// GET /api/notifications/stats - Get notification statistics
export const getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getNotificationStats(userId);

    return sendResponse(
      res,
      200,
      true,
      "Notification statistics fetched successfully",
      stats
    );
  } catch (error) {
    console.error("🔴 [Get Notification Stats Error]:", error.message);
    return sendResponse(res, 500, false, "Failed to fetch notification statistics");
  }
};

// GET /api/notifications/types - Get available notification types
export const getNotificationTypes = async (req, res) => {
  try {
    const types = Object.entries(NOTIFICATION_TYPES).map(([key, value]) => ({
      key,
      value,
      label: key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    }));

    const priorities = Object.entries(NOTIFICATION_PRIORITIES).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
    }));

    return sendResponse(
      res,
      200,
      true,
      "Notification types and priorities fetched successfully",
      { types, priorities }
    );
  } catch (error) {
    console.error("🔴 [Get Notification Types Error]:", error.message);
    return sendResponse(res, 500, false, "Failed to fetch notification types");
  }
};
