import cron from "node-cron";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import { cleanupExpiredNotifications } from "../utils/notificationHelpers.js";
import { createJobExpiringNotification, createJobExpiredNotification } from "../utils/notificationHelpers.js";
import User from "../models/User.js";

/**
 * This cron job runs every day at midnight.
 * It performs the following cleanup tasks:
 * 1. Deletes jobs older than 90 days along with their applications
 * 2. Cleans up expired notifications based on TTL
 * 3. Sends notifications for jobs expiring soon
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

    // Send notifications for jobs expiring in 3 days
    console.log("📧 Checking for jobs expiring soon...");
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const expiringJobs = await Job.find({
      expiresAt: {
        $gte: new Date(),
        $lte: threeDaysFromNow
      },
      status: "active"
    }).populate("createdBy", "name email");

    console.log(`📧 Found ${expiringJobs.length} jobs expiring in 3 days.`);
    
    for (const job of expiringJobs) {
      try {
        const daysLeft = Math.ceil((job.expiresAt - new Date()) / (1000 * 60 * 60 * 24));
        
        await createJobExpiringNotification(
          job.createdBy._id,
          job.title,
          daysLeft,
          { jobId: job._id }
        );
        
        console.log(`📧 Notification sent for job: ${job.title}`);
      } catch (error) {
        console.error(`❌ Failed to send notification for job ${job._id}:`, error.message);
      }
    }

    // Update expired jobs
    console.log("📅 Updating expired jobs...");
    const expiredJobs = await Job.find({
      expiresAt: { $lt: new Date() },
      status: { $ne: "expired" }
    });

    console.log(`📅 Found ${expiredJobs.length} jobs that have expired.`);
    
    for (const job of expiredJobs) {
      try {
        job.status = "expired";
        await job.save();
        
        // Send notification to recruiter
        await createJobExpiredNotification(
          job.createdBy._id,
          job.title,
          { jobId: job._id }
        );
        
        console.log(`📅 Job ${job.title} marked as expired and notification sent.`);
      } catch (error) {
        console.error(`❌ Failed to update job ${job._id}:`, error.message);
      }
    }

    // Summary
    console.log(
      `✨ Auto cleanup summary: ${deletedJobs.deletedCount} jobs, ${deletedApplications.deletedCount} applications, ${expiredNotifications.deletedCount} notifications cleaned up.`
    );
    
  } catch (error) {
    console.error("❌ Error occurred during auto cleanup:", error);
  }
});