import cron from "node-cron";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import { cleanupExpiredNotifications } from "../utils/notificationHelpers.js";

/**
 * This cron job runs every day at midnight.
 * It performs the following cleanup tasks:
 * 1. Deletes jobs older than 90 days along with their applications
 * 2. Cleans up expired notifications based on TTL
 */
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Running auto cleanup job...");

  try {
    // Job and Application Cleanup
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 90); // Jobs older than 90 days

    const oldJobs = await Job.find({ createdAt: { $lt: thresholdDate } });

    console.log(`📦 Found ${oldJobs.length} outdated jobs for cleanup.`);

    let deletedJobs = { deletedCount: 0 };
    let deletedApplications = { deletedCount: 0 };

    if (oldJobs.length > 0) {
      const oldJobIds = oldJobs.map((job) => job._id);

      deletedApplications = await Application.deleteMany({
        job: { $in: oldJobIds },
      });

      deletedJobs = await Job.deleteMany({
        _id: { $in: oldJobIds },
      });

      console.log(
        `🧹 Job cleanup complete! Deleted ${deletedJobs.deletedCount} jobs and ${deletedApplications.deletedCount} applications.`
      );
    } else {
      console.log("✅ No outdated jobs found.");
    }

    // Notification Cleanup
    console.log("🔔 Starting notification cleanup...");
    const expiredNotifications = await cleanupExpiredNotifications();
    
    console.log(
      `🧹 Notification cleanup complete! Deleted ${expiredNotifications.deletedCount} expired notifications.`
    );

    // Summary
    console.log(
      `✨ Auto cleanup summary: ${deletedJobs.deletedCount} jobs, ${deletedApplications.deletedCount} applications, ${expiredNotifications.deletedCount} notifications cleaned up.`
    );
    
  } catch (error) {
    console.error("❌ Error occurred during auto cleanup:", error);
  }
});