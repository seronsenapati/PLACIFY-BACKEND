import cron from 'node-cron';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { createJobExpiringNotification } from '../utils/notificationHelpers.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Cron job to send notifications to recruiters about expiring jobs
 * Runs daily at 9:00 AM
 */
export const startRecruiterNotificationCron = () => {
  // Only run in production or if explicitly enabled
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_CRON !== 'true') {
    console.log('⏭️  Recruiter notification cron job skipped (not in production and not explicitly enabled)');
    return;
  }

  console.log('⏰ Starting recruiter notification cron job (runs daily at 9:00 AM)');

  // Schedule the cron job to run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      logInfo('Recruiter notification cron job started');

      // Find jobs that will expire in the next X days (based on recruiter settings)
      // We'll check for jobs expiring in the next 7 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + 7);
      
      const jobsExpiringSoon = await Job.find({
        status: 'active',
        expiresAt: {
          $gte: new Date(),
          $lte: cutoffDate
        }
      }).populate('createdBy', 'recruiterSettings');

      logInfo(`Found ${jobsExpiringSoon.length} jobs expiring soon`);

      // Group jobs by recruiter and send notifications
      const recruiterNotifications = new Map();
      
      for (const job of jobsExpiringSoon) {
        const recruiter = job.createdBy;
        const recruiterId = recruiter._id.toString();
        
        // Check if recruiter wants notifications
        const notifyBeforeJobExpiration = recruiter.recruiterSettings?.notifyBeforeJobExpiration ?? true;
        const notificationDays = recruiter.recruiterSettings?.jobExpirationNotificationDays || 3;
        
        if (!notifyBeforeJobExpiration) {
          continue; // Skip if recruiter doesn't want notifications
        }

        // Calculate days left until expiration
        const daysLeft = Math.ceil((job.expiresAt - new Date()) / (1000 * 60 * 60 * 24));
        
        // Filter jobs that match the recruiter's notification settings
        if (daysLeft <= notificationDays) {
          // Add job to notifications for this recruiter
          if (!recruiterNotifications.has(recruiterId)) {
            recruiterNotifications.set(recruiterId, {
              recruiter: recruiter,
              jobs: []
            });
          }
          
          recruiterNotifications.get(recruiterId).jobs.push({
            job,
            daysLeft
          });
        }
      }

      // Send notifications to each recruiter
      for (const [recruiterId, { recruiter, jobs }] of recruiterNotifications) {
        // Send a notification for each job
        for (const { job, daysLeft } of jobs) {
          try {
            await createJobExpiringNotification(
              recruiterId,
              job.title,
              daysLeft,
              { jobId: job._id }
            );
            logInfo(`Sent expiration notification for job: ${job.title}`, {
              recruiterId,
              jobId: job._id,
              daysLeft
            });
          } catch (error) {
            logError(`Failed to send expiration notification for job: ${job.title}`, error, {
              recruiterId,
              jobId: job._id
            });
          }
        }
      }

      logInfo('Recruiter notification cron job completed');
    } catch (error) {
      logError('Recruiter notification cron job error', error);
    }
  });
};