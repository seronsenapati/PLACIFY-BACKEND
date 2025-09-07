// controllers/applicationController.js
// Handles status updates and management for job applications

import mongoose from "mongoose";
import Application from "../models/Application.js";
import { sendResponse, sendErrorResponse, sendSuccessResponse } from "../utils/sendResponse.js";
import { createApplicationStatusNotification } from "../utils/notificationHelpers.js";
import { logInfo, logError } from "../utils/logger.js";
import { v4 as uuidv4 } from 'uuid';

// Allowed status values for application updates
const ALLOWED_STATUSES = ["pending", "reviewed", "rejected", "withdrawn"];

/**
 * @desc Update application status (by recruiter)
 * @route PATCH /api/applications/:id
 * @access Recruiter (only for their own job postings)
 */
export const updateApplicationStatus = async (req, res) => {
  const requestId = uuidv4();
  const { id: applicationId } = req.params;
  const { status, reason } = req.body;

  logInfo('Application status update initiated', {
    requestId,
    applicationId,
    requestedStatus: status,
    recruiterId: req.user.id
  });

  // ✅ Validate status value
  if (!ALLOWED_STATUSES.includes(status)) {
    return sendErrorResponse(res, 'APP_003', { allowedStatuses: ALLOWED_STATUSES }, requestId);
  }

  // ✅ Prevent recruiters from directly setting status to "withdrawn" (this is student-only)
  if (status === "withdrawn") {
    return sendErrorResponse(res, 'APP_003', { 
      message: "Recruiters cannot set application status to withdrawn. Applicants must withdraw their own applications."
    }, requestId);
  }

  // ✅ Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return sendErrorResponse(res, 'APP_006', {}, requestId);
  }

  try {
    // ✅ Fetch application with job details
    const application = await Application.findById(applicationId).populate(
      "job"
    );

    if (!application) {
      return sendErrorResponse(res, 'APP_001', {}, requestId);
    }

    const job = application.job;

    // ✅ Ensure recruiter owns the job
    if (job.createdBy.toString() !== req.user.id.toString()) {
      return sendErrorResponse(res, 'APP_004', {}, requestId);
    }

    // Check if status is already the same
    if (application.status === status) {
      return sendSuccessResponse(
        res,
        "Application status is already set to this value",
        application,
        200,
        requestId
      );
    }

    // ✅ Update and save new application status
    application._statusUpdatedBy = req.user.id;
    application.status = status;
    if (reason) {
      // Add reason to the latest status history entry
      const latestHistory = application.statusHistory[application.statusHistory.length - 1];
      if (latestHistory) {
        latestHistory.reason = reason;
      }
    }
    await application.save();

    logInfo('Application status updated successfully', {
      requestId,
      applicationId,
      oldStatus: application.statusHistory[application.statusHistory.length - 2]?.status || 'pending',
      newStatus: status,
      recruiterId: req.user.id
    });

    // ✅ Create notification for student using helper
    try {
      await createApplicationStatusNotification(
        application.student,
        job.title,
        status,
        {
          applicationId: application._id,
          jobId: job._id
        }
      );
    } catch (notificationError) {
      logError('Failed to create status notification', notificationError, {
        requestId,
        applicationId,
        studentId: application.student
      });
      // Don't fail the request if notification fails
    }

    return sendSuccessResponse(
      res,
      "Application status updated successfully",
      application,
      200,
      requestId
    );
  } catch (error) {
    logError("Application status update error", error, {
      requestId,
      applicationId,
      recruiterId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Withdraw application (by student)
 * @route PATCH /api/applications/:id/withdraw
 * @access Student (only for their own applications)
 */
export const withdrawApplication = async (req, res) => {
  const requestId = uuidv4();
  const { id: applicationId } = req.params;
  const { reason } = req.body;

  logInfo('Application withdrawal initiated', {
    requestId,
    applicationId,
    studentId: req.user.id
  });

  // ✅ Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return sendErrorResponse(res, 'APP_006', {}, requestId);
  }

  try {
    // ✅ Fetch application
    const application = await Application.findById(applicationId).populate('job', 'title');

    if (!application) {
      return sendErrorResponse(res, 'APP_001', {}, requestId);
    }

    // ✅ Ensure student owns the application
    if (application.student.toString() !== req.user.id.toString()) {
      return sendErrorResponse(res, 'APP_004', {}, requestId);
    }

    // ✅ Check if application can be withdrawn
    if (!application.canWithdraw()) {
      return sendErrorResponse(res, 'APP_007', { currentStatus: application.status }, requestId);
    }

    // ✅ Withdraw the application
    await application.withdraw(reason || 'Withdrawn by student');

    logInfo('Application withdrawn successfully', {
      requestId,
      applicationId,
      studentId: req.user.id,
      jobTitle: application.job.title
    });

    return sendSuccessResponse(
      res,
      "Application withdrawn successfully",
      application,
      200,
      requestId
    );
  } catch (error) {
    logError("Application withdrawal error", error, {
      requestId,
      applicationId,
      studentId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Get application analytics for a recruiter
 * @route GET /api/applications/analytics
 * @access Recruiter
 */
export const getApplicationAnalytics = async (req, res) => {
  const requestId = uuidv4();
  const { jobId, dateFrom, dateTo } = req.query;

  logInfo('Application analytics requested', {
    requestId,
    recruiterId: req.user.id,
    jobId,
    dateFrom,
    dateTo
  });

  try {
    const matchConditions = {};
    
    // If specific job requested
    if (jobId) {
      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return sendErrorResponse(res, 'JOB_003', {}, requestId);
      }
      matchConditions.job = new mongoose.Types.ObjectId(jobId);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      matchConditions.createdAt = {};
      if (dateFrom) matchConditions.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchConditions.createdAt.$lte = new Date(dateTo);
    }

    // Get applications for jobs created by this recruiter
    const pipeline = [
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'jobDetails'
        }
      },
      {
        $match: {
          'jobDetails.createdBy': new mongoose.Types.ObjectId(req.user.id),
          ...matchConditions
        }
      },
      {
        $group: {
          _id: {
            status: '$status',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.status',
          total: { $sum: '$count' },
          dailyBreakdown: {
            $push: {
              date: '$_id.date',
              count: '$count'
            }
          }
        }
      }
    ];

    const analytics = await Application.aggregate(pipeline);

    // Format the response
    const formattedAnalytics = {
      summary: {
        total: 0,
        pending: 0,
        reviewed: 0,
        rejected: 0,
        withdrawn: 0
      },
      breakdown: {}
    };

    analytics.forEach(item => {
      formattedAnalytics.summary[item._id] = item.total;
      formattedAnalytics.summary.total += item.total;
      formattedAnalytics.breakdown[item._id] = item.dailyBreakdown;
    });

    logInfo('Application analytics generated', {
      requestId,
      recruiterId: req.user.id,
      totalApplications: formattedAnalytics.summary.total
    });

    return sendSuccessResponse(
      res,
      "Application analytics retrieved successfully",
      formattedAnalytics,
      200,
      requestId
    );
  } catch (error) {
    logError("Application analytics error", error, {
      requestId,
      recruiterId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Get application timeline/details for better tracking
 * @route GET /api/applications/:id/timeline
 * @access Student or Recruiter (owner of application/job)
 */
export const getApplicationTimeline = async (req, res) => {
  const requestId = uuidv4();
  const { id: applicationId } = req.params;

  logInfo('Application timeline requested', {
    requestId,
    applicationId,
    userId: req.user.id,
    userRole: req.user.role
  });

  // ✅ Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return sendErrorResponse(res, 'APP_006', {}, requestId);
  }

  try {
    // Get application timeline from model method
    const timeline = await Application.getApplicationTimeline(applicationId);
    
    if (!timeline) {
      return sendErrorResponse(res, 'APP_001', {}, requestId);
    }

    // Check permissions
    const isStudent = req.user.role === 'student' && timeline.student._id.toString() === req.user.id;
    const isRecruiter = req.user.role === 'recruiter';

    if (!isStudent && !isRecruiter) {
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // For recruiters, verify they own the job
    if (isRecruiter) {
      // We would need to populate the job creator to check this
      const application = await Application.findById(applicationId).populate({
        path: 'job',
        populate: {
          path: 'createdBy'
        }
      });
      
      if (!application || application.job.createdBy._id.toString() !== req.user.id) {
        return sendErrorResponse(res, 'APP_004', {}, requestId);
      }
    }

    logInfo('Application timeline retrieved successfully', {
      requestId,
      applicationId,
      userId: req.user.id
    });

    return sendSuccessResponse(
      res,
      "Application timeline retrieved successfully",
      timeline,
      200,
      requestId
    );
  } catch (error) {
    logError("Application timeline error", error, {
      requestId,
      applicationId,
      userId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};