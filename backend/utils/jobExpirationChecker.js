import cron from 'node-cron';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { 
  createJobExpiringNotification, 
  createJobExpiredNotification 
} from '../utils/notificationHelpers.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Check for jobs that are about to expire and send notifications
 */
export const checkExpiringJobs = async () => {
  try {
    logInfo('Checking for expiring jobs...');
    
    // Get all active jobs with expiration dates
    const activeJobs = await Job.find({ 
      status: 'active',
      expiresAt: { $exists: true, $ne: null }
    }).populate('createdBy', 'recruiterSettings');
    
    const now = new Date();
    let notificationCount = 0;
    
    // Check each active job
    for (const job of activeJobs) {
      if (!job.createdBy) continue;
      
      // Get recruiter settings or use defaults
      const settings = job.createdBy.recruiterSettings || {
        notifyBeforeJobExpiration: true,
        jobExpirationNotificationDays: 3
      };
      
      // Skip if notifications are disabled for this recruiter
      if (!settings.notifyBeforeJobExpiration) continue;
      
      // Calculate the notification date
      const notificationDays = settings.jobExpirationNotificationDays || 3;
      const notificationDate = new Date(job.expiresAt);
      notificationDate.setDate(notificationDate.getDate() - notificationDays);
      
      // Check if today is the notification day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      notificationDate.setHours(0, 0, 0, 0);
      
      if (today.getTime() === notificationDate.getTime()) {
        // Send expiring notification
        await createJobExpiringNotification(
          job.createdBy._id.toString(),
          job.title,
          notificationDays,
          { jobId: job._id }
        );
        notificationCount++;
        logInfo(`Sent expiration notification for job: ${job.title}`, {
          recruiterId: job.createdBy._id,
          jobId: job._id,
          daysLeft: notificationDays
        });
      }
      
      // Check if job has already expired
      const jobExpireDate = new Date(job.expiresAt);
      jobExpireDate.setHours(0, 0, 0, 0);
      
      if (today.getTime() >= jobExpireDate.getTime() && job.status !== 'expired') {
        // Update job status to expired
        job.status = 'expired';
        await job.save();
        
        // Send expired notification
        await createJobExpiredNotification(
          job.createdBy._id.toString(),
          job.title,
          { jobId: job._id }
        );
        
        logInfo(`Job ${job.title} marked as expired and notification sent.`, {
          recruiterId: job.createdBy._id,
          jobId: job._id
        });
      }
    }
    
    logInfo(`Job expiration check completed. Sent ${notificationCount} job expiration notifications`);
  } catch (error) {
    logError('Error checking expiring jobs', error);
  }
};

/**
 * Schedule the job expiration checker to run daily at 9 AM
 */
export const scheduleJobExpirationChecker = () => {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', checkExpiringJobs);
  logInfo('Job expiration checker scheduled to run daily at 9:00 AM');
  
  // Also run immediately when server starts (for testing)
  // Uncomment the next line if you want to test immediately
  // checkExpiringJobs();
};

export default { scheduleJobExpirationChecker, checkExpiringJobs };