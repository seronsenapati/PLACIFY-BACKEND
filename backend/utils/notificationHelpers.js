import Notification, { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../models/Notification.js';
import mongoose from 'mongoose';

/**
 * Notification Helper Functions
 * Provides centralized notification creation and management utilities
 */

// Export constants for use in other modules
export { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES };

// Template-based message generation
export const NOTIFICATION_TEMPLATES = {
  [NOTIFICATION_TYPES.APPLICATION_STATUS]: {
    title: (data) => `Application Update: ${data.jobTitle}`,
    message: (data) => `Your application for ${data.jobTitle} has been ${data.status}`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    expiresIn: 30 // days
  },
  [NOTIFICATION_TYPES.NEW_APPLICATION]: {
    title: (data) => `New Application Received`,
    message: (data) => `New application received for ${data.jobTitle} from ${data.applicantName}`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    expiresIn: 30 // days
  },
  [NOTIFICATION_TYPES.JOB_EXPIRING]: {
    title: (data) => `Job Expiring Soon`,
    message: (data) => `Your job posting "${data.jobTitle}" expires in ${data.daysLeft} days`,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    expiresIn: 7 // days
  },
  [NOTIFICATION_TYPES.JOB_EXPIRED]: {
    title: (data) => `Job Expired`,
    message: (data) => `Your job posting "${data.jobTitle}" has expired`,
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    expiresIn: 15 // days
  },
  [NOTIFICATION_TYPES.SYSTEM_MESSAGE]: {
    title: (data) => data.customTitle || 'System Notification',
    message: (data) => data.customMessage || 'You have a new system notification',
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    expiresIn: 30 // days
  },
  [NOTIFICATION_TYPES.ACCOUNT_UPDATE]: {
    title: (data) => 'Account Updated',
    message: (data) => `Your account has been updated: ${data.updateType}`,
    priority: NOTIFICATION_PRIORITIES.LOW,
    expiresIn: 15 // days
  },
  [NOTIFICATION_TYPES.PAYMENT_UPDATE]: {
    title: (data) => 'Payment Update',
    message: (data) => `Payment update: ${data.paymentStatus}`,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    expiresIn: 60 // days
  },
  [NOTIFICATION_TYPES.REMINDER]: {
    title: (data) => data.reminderTitle || 'Reminder',
    message: (data) => data.reminderMessage || 'You have a reminder',
    priority: NOTIFICATION_PRIORITIES.MEDIUM,
    expiresIn: 7 // days
  }
};

/**
 * Create a single notification
 * @param {string} userId - The user ID to send notification to
 * @param {string} type - Notification type from NOTIFICATION_TYPES
 * @param {object} data - Data object for template generation
 * @param {object} options - Additional options (priority, expiresIn, metadata)
 * @returns {Promise<object>} Created notification
 */
export const createNotification = async (userId, type, data = {}, options = {}) => {
  try {
    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    // Validate notification type
    if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
      throw new Error(`Invalid notification type: ${type}`);
    }

    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) {
      throw new Error(`No template found for notification type: ${type}`);
    }

    // Generate title and message from template
    const title = typeof template.title === 'function' ? template.title(data) : template.title;
    const message = typeof template.message === 'function' ? template.message(data) : template.message;

    // Calculate expiration date
    const expiresIn = options.expiresIn || template.expiresIn;
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresIn);
    }

    // Create notification object
    const notificationData = {
      user: userId,
      type,
      title,
      message,
      priority: options.priority || template.priority || NOTIFICATION_PRIORITIES.MEDIUM,
      metadata: {
        ...data,
        ...options.metadata
      }
    };

    if (expiresAt) {
      notificationData.expiresAt = expiresAt;
    }

    const notification = await Notification.create(notificationData);
    return notification;
  } catch (error) {
    console.error('🔴 [Create Notification Error]:', error.message);
    throw error;
  }
};

/**
 * Create multiple notifications (bulk operation)
 * @param {Array} notifications - Array of notification objects
 * @returns {Promise<Array>} Created notifications
 */
export const createBulkNotifications = async (notifications) => {
  try {
    const validNotifications = [];

    for (const notif of notifications) {
      const { userId, type, data = {}, options = {} } = notif;
      
      // Validate each notification
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`Invalid user ID skipped: ${userId}`);
        continue;
      }

      if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
        console.warn(`Invalid notification type skipped: ${type}`);
        continue;
      }

      const template = NOTIFICATION_TEMPLATES[type];
      if (!template) {
        console.warn(`No template found for type: ${type}`);
        continue;
      }

      // Generate notification data
      const title = typeof template.title === 'function' ? template.title(data) : template.title;
      const message = typeof template.message === 'function' ? template.message(data) : template.message;

      const expiresIn = options.expiresIn || template.expiresIn;
      let expiresAt = null;
      if (expiresIn) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresIn);
      }

      const notificationData = {
        user: userId,
        type,
        title,
        message,
        priority: options.priority || template.priority || NOTIFICATION_PRIORITIES.MEDIUM,
        metadata: {
          ...data,
          ...options.metadata
        }
      };

      if (expiresAt) {
        notificationData.expiresAt = expiresAt;
      }

      validNotifications.push(notificationData);
    }

    if (validNotifications.length === 0) {
      return [];
    }

    const createdNotifications = await Notification.insertMany(validNotifications);
    return createdNotifications;
  } catch (error) {
    console.error('🔴 [Bulk Create Notifications Error]:', error.message);
    throw error;
  }
};

/**
 * Create application status notification
 * @param {string} studentId - Student user ID
 * @param {string} jobTitle - Job title
 * @param {string} status - Application status
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} Created notification
 */
export const createApplicationStatusNotification = async (studentId, jobTitle, status, metadata = {}) => {
  return await createNotification(
    studentId,
    NOTIFICATION_TYPES.APPLICATION_STATUS,
    { jobTitle, status },
    { metadata: { applicationId: metadata.applicationId, jobId: metadata.jobId } }
  );
};

/**
 * Create new application notification for recruiter
 * @param {string} recruiterId - Recruiter user ID
 * @param {string} jobTitle - Job title
 * @param {string} applicantName - Applicant name
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} Created notification
 */
export const createNewApplicationNotification = async (recruiterId, jobTitle, applicantName, metadata = {}) => {
  return await createNotification(
    recruiterId,
    NOTIFICATION_TYPES.NEW_APPLICATION,
    { jobTitle, applicantName },
    { metadata: { applicationId: metadata.applicationId, jobId: metadata.jobId, studentId: metadata.studentId } }
  );
};

/**
 * Create job expiring notification
 * @param {string} recruiterId - Recruiter user ID
 * @param {string} jobTitle - Job title
 * @param {number} daysLeft - Days left until expiration
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} Created notification
 */
export const createJobExpiringNotification = async (recruiterId, jobTitle, daysLeft, metadata = {}) => {
  return await createNotification(
    recruiterId,
    NOTIFICATION_TYPES.JOB_EXPIRING,
    { jobTitle, daysLeft },
    { metadata: { jobId: metadata.jobId } }
  );
};

/**
 * Create job expired notification
 * @param {string} recruiterId - Recruiter user ID
 * @param {string} jobTitle - Job title
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} Created notification
 */
export const createJobExpiredNotification = async (recruiterId, jobTitle, metadata = {}) => {
  return await createNotification(
    recruiterId,
    NOTIFICATION_TYPES.JOB_EXPIRED,
    { jobTitle },
    { metadata: { jobId: metadata.jobId } }
  );
};

/**
 * Create system message notification
 * @param {string} userId - User ID
 * @param {string} title - Custom title
 * @param {string} message - Custom message
 * @param {object} options - Additional options
 * @returns {Promise<object>} Created notification
 */
export const createSystemNotification = async (userId, title, message, options = {}) => {
  return await createNotification(
    userId,
    NOTIFICATION_TYPES.SYSTEM_MESSAGE,
    { customTitle: title, customMessage: message },
    options
  );
};

/**
 * Create recruiter settings update notification
 * @param {string} recruiterId - Recruiter user ID
 * @param {string} settingName - Name of the setting that was updated
 * @returns {Promise<object>} Created notification
 */
export const createRecruiterSettingsUpdateNotification = async (recruiterId, settingName) => {
  return await createNotification(
    recruiterId,
    NOTIFICATION_TYPES.ACCOUNT_UPDATE,
    { updateType: `Recruiter settings updated: ${settingName}` },
    { priority: NOTIFICATION_PRIORITIES.LOW }
  );
};

/**
 * Create application auto-review notification
 * @param {string} recruiterId - Recruiter user ID
 * @param {string} jobTitle - Job title
 * @param {number} count - Number of applications auto-reviewed
 * @returns {Promise<object>} Created notification
 */
export const createApplicationAutoReviewNotification = async (recruiterId, jobTitle, count) => {
  return await createNotification(
    recruiterId,
    NOTIFICATION_TYPES.SYSTEM_MESSAGE,
    { 
      customTitle: 'Applications Auto-Reviewed',
      customMessage: `${count} applications for "${jobTitle}" have been automatically reviewed based on your settings.`
    },
    { priority: NOTIFICATION_PRIORITIES.MEDIUM }
  );
};

/**
 * Mark notifications as read by criteria
 * @param {string} userId - User ID
 * @param {object} criteria - Additional criteria for filtering
 * @returns {Promise<object>} Update result
 */
export const markNotificationsAsRead = async (userId, criteria = {}) => {
  try {
    return await Notification.markAsReadByCriteria(userId, criteria);
  } catch (error) {
    console.error('🔴 [Mark Notifications Read Error]:', error.message);
    throw error;
  }
};

/**
 * Delete notifications by criteria
 * @param {string} userId - User ID
 * @param {object} criteria - Additional criteria for filtering
 * @returns {Promise<object>} Delete result
 */
export const deleteNotificationsByCriteria = async (userId, criteria = {}) => {
  try {
    const filter = { user: userId, ...criteria };
    return await Notification.deleteMany(filter);
  } catch (error) {
    console.error('🔴 [Delete Notifications Error]:', error.message);
    throw error;
  }
};

/**
 * Get notification statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Notification statistics
 */
export const getNotificationStats = async (userId) => {
  try {
    const [totalCount, unreadCount, countsByType] = await Promise.all([
      Notification.countDocuments({ user: userId }),
      Notification.countDocuments({ user: userId, read: false }),
      Notification.getCountsByType(userId)
    ]);

    return {
      total: totalCount,
      unread: unreadCount,
      read: totalCount - unreadCount,
      byType: countsByType
    };
  } catch (error) {
    console.error('🔴 [Get Notification Stats Error]:', error.message);
    throw error;
  }
};

/**
 * Clean up expired notifications
 * @returns {Promise<object>} Cleanup result
 */
export const cleanupExpiredNotifications = async () => {
  try {
    const result = await Notification.deleteMany({
      expiresAt: { $lte: new Date() }
    });
    return result;
  } catch (error) {
    console.error('🔴 [Cleanup Expired Notifications Error]:', error.message);
    throw error;
  }
};

/**
 * Validate notification type
 * @param {string} type - Notification type
 * @returns {boolean} Is valid type
 */
export const isValidNotificationType = (type) => {
  return Object.values(NOTIFICATION_TYPES).includes(type);
};

/**
 * Validate notification priority
 * @param {string} priority - Notification priority
 * @returns {boolean} Is valid priority
 */
export const isValidNotificationPriority = (priority) => {
  return Object.values(NOTIFICATION_PRIORITIES).includes(priority);
};