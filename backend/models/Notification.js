import mongoose from "mongoose";

// Notification types enum
export const NOTIFICATION_TYPES = {
  APPLICATION_STATUS: 'application_status',
  NEW_APPLICATION: 'new_application',
  JOB_EXPIRING: 'job_expiring',
  JOB_EXPIRED: 'job_expired',
  SYSTEM_MESSAGE: 'system_message',
  ACCOUNT_UPDATE: 'account_update',
  PAYMENT_UPDATE: 'payment_update',
  REMINDER: 'reminder'
};

// Priority levels
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITIES),
      default: NOTIFICATION_PRIORITIES.MEDIUM,
      index: true
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 }
    }
  },
  { 
    timestamps: true,
    // Add compound indexes for common query patterns
    index: [
      { user: 1, read: 1, createdAt: -1 },
      { user: 1, type: 1, createdAt: -1 },
      { user: 1, priority: 1, createdAt: -1 },
      { createdAt: -1 }
    ]
  }
);

// Instance method to check if notification is expired
notificationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Static method to get notification counts by type
notificationSchema.statics.getCountsByType = async function(userId) {
  return await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } }
      }
    }
  ]);
};

// Static method to mark notifications as read by criteria
notificationSchema.statics.markAsReadByCriteria = async function(userId, criteria = {}) {
  const filter = { user: userId, read: false, ...criteria };
  return await this.updateMany(filter, { $set: { read: true, readAt: new Date() } });
};

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
