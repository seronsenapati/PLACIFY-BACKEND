import cron from "node-cron";
import Job from "../models/Job.js";
import Application from "../models/Application.js";

cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Running auto cleanup job...");

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 90); // 90 days ago

    const oldJobs = await Job.find({ createdAt: { $lt: thresholdDate } });

    if (oldJobs.length === 0) {
      console.log("✅ No outdated jobs found.");
      return;
    }

    const oldJobIds = oldJobs.map((job) => job._id);

    const deletedApplications = await Application.deleteMany({
      job: { $in: oldJobIds },
    });

    const deletedJobs = await Job.deleteMany({
      _id: { $in: oldJobIds },
    });

    console.log(
      `🧹 Cleanup complete! Deleted ${deletedJobs.deletedCount} jobs and ${deletedApplications.deletedCount} applications.`
    );
  } catch (error) {
    console.error("❌ Error occurred during auto cleanup:", error.message);
  }
});
