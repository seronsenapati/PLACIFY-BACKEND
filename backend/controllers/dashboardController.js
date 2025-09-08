import mongoose from "mongoose";
import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/sendResponse.js";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * @desc Get student dashboard overview with consolidated information
 * @route GET /api/dashboard/student/overview
 * @access Student
 */
export const getStudentDashboardOverview = async (req, res) => {
  const requestId = uuidv4();

  logInfo('Fetching student dashboard overview', {
    requestId,
    studentId: req.user.id
  });

  try {
    if (req.user.role !== "student") {
      logWarn('Non-student user attempted to fetch dashboard overview', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Execute all queries in parallel for better performance
    const [applicationsStats, user, recentApplications] = await Promise.all([
      Application.getStatsByStudent(req.user.id)
        .catch(err => {
          logError("Database error when fetching application stats", err, {
            requestId,
            studentId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      User.findById(req.user.id)
        .populate({
          path: "bookmarkedJobs",
          match: { status: "active" }
        })
        .catch(err => {
          logError("Database error when fetching user data", err, {
            requestId,
            studentId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Application.find({ student: req.user.id })
        .populate({
          path: "job",
          populate: {
            path: "createdBy",
            select: "name email profile.company"
          }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .catch(err => {
          logError("Database error when fetching recent applications", err, {
            requestId,
            studentId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        })
    ]).catch(err => {
      if (err.message === 'DATABASE_ERROR') {
        return sendErrorResponse(res, 'SYS_001', {}, requestId);
      }
      throw err;
    });

    // Process recent applications
    const enhancedRecentApplications = recentApplications.map(app => ({
      id: app._id,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      canWithdraw: app.status === 'pending',
      daysSinceApplication: Math.floor((new Date() - new Date(app.createdAt)) / (1000 * 60 * 60 * 24)),
      job: app.job ? {
        id: app.job._id,
        title: app.job.title,
        role: app.job.role,
        location: app.job.location,
        company: app.job.createdBy ? {
          name: app.job.createdBy.name,
          email: app.job.createdBy.email,
          company: app.job.createdBy.profile?.company
        } : null
      } : null
    }));

    // Calculate key metrics
    const totalApplications = applicationsStats.total || 0;
    const activeApplications = applicationsStats.pending || 0;
    const reviewedApplications = applicationsStats.reviewed || 0;
    const rejectedApplications = applicationsStats.rejected || 0;
    
    const responseRate = totalApplications > 0 
      ? ((reviewedApplications + rejectedApplications) / totalApplications * 100).toFixed(1) 
      : 0;
      
    const successRate = (reviewedApplications + rejectedApplications) > 0
      ? (reviewedApplications / (reviewedApplications + rejectedApplications) * 100).toFixed(1)
      : 0;

    // Get upcoming deadlines from bookmarked jobs
    const bookmarkedJobs = user.bookmarkedJobs || [];
    const upcomingDeadlines = bookmarkedJobs
      .filter(job => job.applicationDeadline && new Date(job.applicationDeadline) > new Date())
      .map(job => ({
        id: job._id,
        title: job.title,
        applicationDeadline: job.applicationDeadline,
        daysUntilDeadline: Math.ceil((new Date(job.applicationDeadline) - new Date()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => new Date(a.applicationDeadline) - new Date(b.applicationDeadline))
      .slice(0, 3); // Get top 3 soonest deadlines

    // Dashboard overview data
    const overview = {
      applications: {
        total: totalApplications,
        active: activeApplications,
        reviewed: reviewedApplications,
        rejected: rejectedApplications,
        successRate: parseFloat(successRate),
        responseRate: parseFloat(responseRate)
      },
      bookmarks: {
        total: bookmarkedJobs.length
      },
      recentActivity: enhancedRecentApplications,
      upcomingDeadlines: upcomingDeadlines,
      profileCompletion: user.profileCompleted ? 100 : 75 // Simplified for now
    };

    logInfo('Student dashboard overview fetched successfully', {
      requestId,
      studentId: req.user.id,
      totalApplications,
      bookmarkedJobs: bookmarkedJobs.length
    });

    return sendSuccessResponse(
      res,
      "Dashboard overview fetched successfully",
      overview,
      200,
      requestId
    );
  } catch (error) {
    logError("Student dashboard overview error", error, {
      requestId,
      studentId: req.user.id
    });
    
    if (error.name === "CastError") {
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }
    
    // Handle database connection errors
    if (error.name === "MongoNetworkError" || error.name === "MongoServerSelectionError") {
      return sendErrorResponse(res, 'SYS_002', {}, requestId);
    }
    
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Get detailed student application analytics
 * @route GET /api/dashboard/student/analytics
 * @access Student
 */
export const getStudentApplicationAnalytics = async (req, res) => {
  const requestId = uuidv4();
  const { timeframe = '30' } = req.query; // days

  logInfo('Fetching student application analytics', {
    requestId,
    studentId: req.user.id,
    timeframe
  });

  try {
    if (req.user.role !== "student") {
      logWarn('Non-student user attempted to fetch application analytics', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    const daysBack = parseInt(timeframe) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const pipeline = [
      {
        $match: {
          student: new mongoose.Types.ObjectId(req.user.id),
          createdAt: { $gte: fromDate }
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

    const [recentStats, overallStats] = await Promise.all([
      Application.aggregate(pipeline)
        .catch(err => {
          logError("Database aggregation error when fetching recent stats", err, {
            requestId,
            studentId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Application.getStatsByStudent(req.user.id)
        .catch(err => {
          logError("Database error when fetching overall stats", err, {
            requestId,
            studentId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        })
    ]).catch(err => {
      if (err.message === 'DATABASE_ERROR') {
        return sendErrorResponse(res, 'SYS_001', {}, requestId);
      }
      throw err;
    });

    // Format recent statistics
    const recentSummary = {
      total: 0,
      pending: 0,
      reviewed: 0,
      rejected: 0,
      withdrawn: 0
    };

    const dailyBreakdown = {};

    recentStats.forEach(item => {
      recentSummary[item._id] = item.total;
      recentSummary.total += item.total;
      dailyBreakdown[item._id] = item.dailyBreakdown;
    });

    // Calculate trends
    const responseRate = overallStats.total > 0 
      ? ((overallStats.reviewed + overallStats.rejected) / overallStats.total * 100).toFixed(1)
      : 0;

    const successRate = (overallStats.reviewed + overallStats.rejected) > 0
      ? (overallStats.reviewed / (overallStats.reviewed + overallStats.rejected) * 100).toFixed(1)
      : 0;

    // Calculate application trends over time
    const trendAnalysis = {
      dailyApplications: [],
      weeklyComparison: {
        currentWeek: 0,
        previousWeek: 0,
        change: 0
      }
    };

    // Get current week applications
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    const currentWeekCount = await Application.countDocuments({
      student: new mongoose.Types.ObjectId(req.user.id),
      createdAt: { $gte: currentWeekStart }
    }).catch(err => {
      logError("Database error when counting current week applications", err, {
        requestId,
        studentId: req.user.id
      });
      throw new Error('DATABASE_ERROR');
    });

    // Get previous week applications
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    const previousWeekCount = await Application.countDocuments({
      student: new mongoose.Types.ObjectId(req.user.id),
      createdAt: { 
        $gte: previousWeekStart,
        $lt: previousWeekEnd
      }
    }).catch(err => {
      logError("Database error when counting previous week applications", err, {
        requestId,
        studentId: req.user.id
      });
      throw new Error('DATABASE_ERROR');
    });

    // Calculate trend
    const trendChange = previousWeekCount > 0 
      ? ((currentWeekCount - previousWeekCount) / previousWeekCount * 100).toFixed(1)
      : (currentWeekCount > 0 ? 100 : 0);

    trendAnalysis.weeklyComparison = {
      currentWeek: currentWeekCount,
      previousWeek: previousWeekCount,
      change: parseFloat(trendChange)
    };

    const response = {
      timeframe: {
        days: daysBack,
        from: fromDate.toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      },
      recent: {
        summary: recentSummary,
        dailyBreakdown
      },
      overall: overallStats,
      insights: {
        responseRate: parseFloat(responseRate),
        successRate: parseFloat(successRate),
        averageResponseTime: 'N/A', // Could be calculated if we track response times
        activeApplications: overallStats.pending || 0,
        trendAnalysis
      }
    };

    logInfo('Student application analytics generated', {
      requestId,
      studentId: req.user.id,
      timeframeDays: daysBack,
      totalApplications: overallStats.total
    });

    return sendSuccessResponse(
      res,
      "Application analytics retrieved successfully",
      response,
      200,
      requestId
    );
  } catch (error) {
    logError("Student application analytics error", error, {
      requestId,
      studentId: req.user.id
    });
    
    if (error.name === "CastError") {
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }
    
    // Handle database connection errors
    if (error.name === "MongoNetworkError" || error.name === "MongoServerSelectionError") {
      return sendErrorResponse(res, 'SYS_002', {}, requestId);
    }
    
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Get recruiter dashboard overview with consolidated information
 * @route GET /api/dashboard/recruiter/overview
 * @access Recruiter
 */
export const getRecruiterDashboardOverview = async (req, res) => {
  const requestId = uuidv4();

  logInfo('Fetching recruiter dashboard overview', {
    requestId,
    recruiterId: req.user.id
  });

  try {
    if (req.user.role !== "recruiter") {
      logWarn('Non-recruiter user attempted to fetch dashboard overview', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Get recruiter with settings and company
    const recruiter = await User.findById(req.user.id).populate('company');
    
    if (!recruiter || !recruiter.company) {
      logWarn('Recruiter does not have an associated company', {
        requestId,
        userId: req.user.id
      });
      return sendErrorResponse(res, 'COMPANY_001', {}, requestId);
    }

    // Execute all queries in parallel for better performance
    const [jobStats, recentJobs, applicationStats, notificationStats] = await Promise.all([
      Job.getStatsByRecruiter(req.user.id)
        .catch(err => {
          logError("Database error when fetching job stats", err, {
            requestId,
            recruiterId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Job.find({ createdBy: req.user.id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .catch(err => {
          logError("Database error when fetching recent jobs", err, {
            requestId,
            recruiterId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Application.getStatsByRecruiter(req.user.id)
        .catch(err => {
          logError("Database error when fetching application stats", err, {
            requestId,
            recruiterId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      // Get notification statistics
      Notification.getCountsByType(req.user.id)
        .catch(err => {
          logError("Database error when fetching notification stats", err, {
            requestId,
            recruiterId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        })
    ]).catch(err => {
      if (err.message === 'DATABASE_ERROR') {
        return sendErrorResponse(res, 'SYS_001', {}, requestId);
      }
      throw err;
    });

    // Process recent jobs with more detailed information
    const enhancedRecentJobs = recentJobs.map(job => ({
      id: job._id,
      title: job.title,
      role: job.role,
      location: job.location,
      status: job.status,
      applicationDeadline: job.applicationDeadline,
      daysUntilDeadline: job.applicationDeadline 
        ? Math.ceil((new Date(job.applicationDeadline) - new Date()) / (1000 * 60 * 60 * 24))
        : null,
      isExpiringSoon: job.applicationDeadline 
        ? Math.ceil((new Date(job.applicationDeadline) - new Date()) / (1000 * 60 * 60 * 24)) <= 3
        : false,
      // Add application count for this job
      applicationCount: job.applications ? job.applications.length : 0
    }));

    // Calculate key metrics
    const totalJobs = jobStats.total || 0;
    const activeJobs = jobStats.active || 0;
    const expiredJobs = jobStats.expired || 0;
    
    const totalApplications = applicationStats.total || 0;
    const pendingApplications = applicationStats.pending || 0;
    const reviewedApplications = applicationStats.reviewed || 0;
    const rejectedApplications = applicationStats.rejected || 0;
    
    const responseRate = totalApplications > 0 
      ? ((reviewedApplications + rejectedApplications) / totalApplications * 100).toFixed(1) 
      : 0;

    // Process notification statistics
    const notificationSummary = {
      total: 0,
      unread: 0,
      byType: {}
    };

    if (notificationStats) {
      notificationStats.forEach(item => {
        notificationSummary.byType[item._id] = {
          total: item.total,
          unread: item.unread
        };
        notificationSummary.total += item.total;
        notificationSummary.unread += item.unread;
      });
    }

    // Dashboard overview data
    const overview = {
      jobs: {
        total: totalJobs,
        active: activeJobs,
        expired: expiredJobs
      },
      applications: {
        total: totalApplications,
        pending: pendingApplications,
        reviewed: reviewedApplications,
        rejected: rejectedApplications,
        responseRate: parseFloat(responseRate)
      },
      company: {
        name: recruiter.company.name,
        id: recruiter.company._id,
        profileCompleteness: recruiter.company.profileCompleteness || 0
      },
      recentActivity: enhancedRecentJobs,
      notifications: notificationSummary,
      // Use recruiter settings for dashboard metrics if available
      settings: {
        defaultJobExpirationDays: recruiter.recruiterSettings?.defaultJobExpirationDays || 30,
        defaultApplicationDeadlineDays: recruiter.recruiterSettings?.defaultApplicationDeadlineDays || 14,
        notifyBeforeJobExpiration: recruiter.recruiterSettings?.notifyBeforeJobExpiration ?? true,
        jobExpirationNotificationDays: recruiter.recruiterSettings?.jobExpirationNotificationDays || 3,
        autoReviewApplications: recruiter.recruiterSettings?.autoReviewApplications || false,
        applicationReviewThreshold: recruiter.recruiterSettings?.applicationReviewThreshold || 10
      }
    };

    logInfo('Recruiter dashboard overview fetched successfully', {
      requestId,
      recruiterId: req.user.id,
      totalJobs,
      totalApplications
    });

    return sendSuccessResponse(
      res,
      "Dashboard overview fetched successfully",
      overview,
      200,
      requestId
    );
  } catch (error) {
    logError("Recruiter dashboard overview error", error, {
      requestId,
      recruiterId: req.user.id
    });
    
    if (error.name === "CastError") {
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }
    
    // Handle database connection errors
    if (error.name === "MongoNetworkError" || error.name === "MongoServerSelectionError") {
      return sendErrorResponse(res, 'SYS_002', {}, requestId);
    }
    
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Get detailed recruiter application analytics
 * @route GET /api/dashboard/recruiter/analytics
 * @access Recruiter
 */
export const getRecruiterApplicationAnalytics = async (req, res) => {
  const requestId = uuidv4();
  const { timeframe = '30' } = req.query; // days

  logInfo('Fetching recruiter application analytics', {
    requestId,
    recruiterId: req.user.id,
    timeframe
  });

  try {
    if (req.user.role !== "recruiter") {
      logWarn('Non-recruiter user attempted to fetch application analytics', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    const daysBack = parseInt(timeframe) || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    // Get jobs created by recruiter
    const recruiterJobs = await Job.find({ createdBy: req.user.id }).select('_id');
    const jobIds = recruiterJobs.map(job => job._id);

    if (jobIds.length === 0) {
      // No jobs, return empty analytics
      return sendSuccessResponse(
        res,
        "Application analytics retrieved successfully",
        {
          timeframe: {
            days: daysBack,
            from: fromDate.toISOString().split('T')[0],
            to: new Date().toISOString().split('T')[0]
          },
          recent: {
            summary: {
              total: 0,
              pending: 0,
              reviewed: 0,
              rejected: 0,
              withdrawn: 0
            },
            dailyBreakdown: {}
          },
          overall: {
            total: 0,
            pending: 0,
            reviewed: 0,
            rejected: 0,
            withdrawn: 0
          },
          insights: {
            responseRate: 0,
            successRate: 0,
            averageResponseTime: 'N/A',
            activeApplications: 0,
            trendAnalysis: {
              dailyApplications: [],
              weeklyComparison: {
                currentWeek: 0,
                previousWeek: 0,
                change: 0
              }
            }
          },
          topPerformingJobs: []
        },
        200,
        requestId
      );
    }

    const pipeline = [
      {
        $match: {
          job: { $in: jobIds },
          createdAt: { $gte: fromDate }
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

    const [recentStats, overallStats, topJobs] = await Promise.all([
      Application.aggregate(pipeline)
        .catch(err => {
          logError("Database aggregation error when fetching recent stats", err, {
            requestId,
            recruiterId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Application.getStatsByRecruiter(req.user.id)
        .catch(err => {
          logError("Database error when fetching overall stats", err, {
            requestId,
            recruiterId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      // Get top performing jobs by application count
      Application.aggregate([
        {
          $match: {
            job: { $in: jobIds }
          }
        },
        {
          $group: {
            _id: '$job',
            applicationCount: { $sum: 1 },
            statusBreakdown: {
              $push: '$status'
            }
          }
        },
        {
          $lookup: {
            from: 'jobs',
            localField: '_id',
            foreignField: '_id',
            as: 'jobDetails'
          }
        },
        {
          $unwind: '$jobDetails'
        },
        {
          $project: {
            _id: 1,
            title: '$jobDetails.title',
            applicationCount: 1,
            reviewedCount: {
              $size: {
                $filter: {
                  input: '$statusBreakdown',
                  cond: { $eq: ['$$this', 'reviewed'] }
                }
              }
            },
            rejectedCount: {
              $size: {
                $filter: {
                  input: '$statusBreakdown',
                  cond: { $eq: ['$$this', 'rejected'] }
                }
              }
            }
          }
        },
        {
          $sort: { applicationCount: -1 }
        },
        {
          $limit: 5
        }
      ])
        .catch(err => {
          logError("Database aggregation error when fetching top jobs", err, {
            requestId,
            recruiterId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        })
    ]).catch(err => {
      if (err.message === 'DATABASE_ERROR') {
        return sendErrorResponse(res, 'SYS_001', {}, requestId);
      }
      throw err;
    });

    // Format recent statistics
    const recentSummary = {
      total: 0,
      pending: 0,
      reviewed: 0,
      rejected: 0,
      withdrawn: 0
    };

    const dailyBreakdown = {};

    recentStats.forEach(item => {
      recentSummary[item._id] = item.total;
      recentSummary.total += item.total;
      dailyBreakdown[item._id] = item.dailyBreakdown;
    });

    // Calculate trends
    const responseRate = overallStats.total > 0 
      ? ((overallStats.reviewed + overallStats.rejected) / overallStats.total * 100).toFixed(1)
      : 0;

    const successRate = (overallStats.reviewed + overallStats.rejected) > 0
      ? (overallStats.reviewed / (overallStats.reviewed + overallStats.rejected) * 100).toFixed(1)
      : 0;

    // Calculate application trends over time
    const trendAnalysis = {
      dailyApplications: [],
      weeklyComparison: {
        currentWeek: 0,
        previousWeek: 0,
        change: 0
      }
    };

    // Get current week applications
    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    const currentWeekCount = await Application.countDocuments({
      job: { $in: jobIds },
      createdAt: { $gte: currentWeekStart }
    }).catch(err => {
      logError("Database error when counting current week applications", err, {
        requestId,
        recruiterId: req.user.id
      });
      throw new Error('DATABASE_ERROR');
    });

    // Get previous week applications
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    const previousWeekCount = await Application.countDocuments({
      job: { $in: jobIds },
      createdAt: { 
        $gte: previousWeekStart,
        $lt: previousWeekEnd
      }
    }).catch(err => {
      logError("Database error when counting previous week applications", err, {
        requestId,
        recruiterId: req.user.id
      });
      throw new Error('DATABASE_ERROR');
    });

    // Calculate trend
    const trendChange = previousWeekCount > 0 
      ? ((currentWeekCount - previousWeekCount) / previousWeekCount * 100).toFixed(1)
      : (currentWeekCount > 0 ? 100 : 0);

    trendAnalysis.weeklyComparison = {
      currentWeek: currentWeekCount,
      previousWeek: previousWeekCount,
      change: parseFloat(trendChange)
    };

    const response = {
      timeframe: {
        days: daysBack,
        from: fromDate.toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      },
      recent: {
        summary: recentSummary,
        dailyBreakdown
      },
      overall: overallStats,
      insights: {
        responseRate: parseFloat(responseRate),
        successRate: parseFloat(successRate),
        averageResponseTime: 'N/A', // Could be calculated if we track response times
        activeApplications: overallStats.pending || 0,
        trendAnalysis
      },
      topPerformingJobs: topJobs
    };

    logInfo('Recruiter application analytics generated', {
      requestId,
      recruiterId: req.user.id,
      timeframeDays: daysBack,
      totalApplications: overallStats.total
    });

    return sendSuccessResponse(
      res,
      "Application analytics retrieved successfully",
      response,
      200,
      requestId
    );
  } catch (error) {
    logError("Recruiter application analytics error", error, {
      requestId,
      recruiterId: req.user.id
    });
    
    if (error.name === "CastError") {
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }
    
    // Handle database connection errors
    if (error.name === "MongoNetworkError" || error.name === "MongoServerSelectionError") {
      return sendErrorResponse(res, 'SYS_002', {}, requestId);
    }
    
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Get detailed recruiter job statistics
 * @route GET /api/dashboard/recruiter/job-stats
 * @access Recruiter
 */
export const getRecruiterJobStats = async (req, res) => {
  const requestId = uuidv4();

  logInfo('Fetching recruiter job statistics', {
    requestId,
    recruiterId: req.user.id
  });

  try {
    if (req.user.role !== "recruiter") {
      logWarn('Non-recruiter user attempted to fetch job statistics', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Get detailed job statistics
    const jobStats = await Job.getDetailedStatsByRecruiter(req.user.id);
    
    // Get jobs expiring soon (within 7 days)
    const expiringSoon = await Job.getExpiringSoonByRecruiter(req.user.id, 7);

    const response = {
      statistics: jobStats,
      expiringSoon: expiringSoon
    };

    logInfo('Recruiter job statistics fetched successfully', {
      requestId,
      recruiterId: req.user.id
    });

    return sendSuccessResponse(
      res,
      "Job statistics fetched successfully",
      response,
      200,
      requestId
    );
  } catch (error) {
    logError("Recruiter job statistics error", error, {
      requestId,
      recruiterId: req.user.id
    });
    
    if (error.name === "CastError") {
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }
    
    // Handle database connection errors
    if (error.name === "MongoNetworkError" || error.name === "MongoServerSelectionError") {
      return sendErrorResponse(res, 'SYS_002', {}, requestId);
    }
    
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Get admin dashboard overview with consolidated information
 * @route GET /api/dashboard/admin/overview
 * @access Admin
 */
export const getAdminDashboardOverview = async (req, res) => {
  const requestId = uuidv4();

  logInfo('Fetching admin dashboard overview', {
    requestId,
    adminId: req.user.id
  });

  try {
    if (req.user.role !== "admin") {
      logWarn('Non-admin user attempted to fetch dashboard overview', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Execute all queries in parallel for better performance
    const [userStats, jobStats, applicationStats, companyStats] = await Promise.all([
      User.getStats()
        .catch(err => {
          logError("Database error when fetching user stats", err, {
            requestId,
            adminId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Job.getStats()
        .catch(err => {
          logError("Database error when fetching job stats", err, {
            requestId,
            adminId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Application.getStats()
        .catch(err => {
          logError("Database error when fetching application stats", err, {
            requestId,
            adminId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Company.getStats()
        .catch(err => {
          logError("Database error when fetching company stats", err, {
            requestId,
            adminId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        })
    ]).catch(err => {
      if (err.message === 'DATABASE_ERROR') {
        return sendErrorResponse(res, 'SYS_001', {}, requestId);
      }
      throw err;
    });

    // Calculate key metrics
    const totalUsers = userStats.total || 0;
    const totalStudents = userStats.students || 0;
    const totalRecruiters = userStats.recruiters || 0;
    
    const totalJobs = jobStats.total || 0;
    const activeJobs = jobStats.active || 0;
    const expiredJobs = jobStats.expired || 0;
    
    const totalApplications = applicationStats.total || 0;
    const pendingApplications = applicationStats.pending || 0;
    const reviewedApplications = applicationStats.reviewed || 0;
    const rejectedApplications = applicationStats.rejected || 0;
    
    const totalCompanies = companyStats.total || 0;
    
    const responseRate = totalApplications > 0 
      ? ((reviewedApplications + rejectedApplications) / totalApplications * 100).toFixed(1) 
      : 0;

    // Dashboard overview data
    const overview = {
      users: {
        total: totalUsers,
        students: totalStudents,
        recruiters: totalRecruiters
      },
      jobs: {
        total: totalJobs,
        active: activeJobs,
        expired: expiredJobs
      },
      applications: {
        total: totalApplications,
        pending: pendingApplications,
        reviewed: reviewedApplications,
        rejected: rejectedApplications,
        responseRate: parseFloat(responseRate)
      },
      companies: {
        total: totalCompanies
      }
    };

    logInfo('Admin dashboard overview fetched successfully', {
      requestId,
      adminId: req.user.id,
      totalUsers,
      totalJobs,
      totalApplications
    });

    return sendSuccessResponse(
      res,
      "Dashboard overview fetched successfully",
      overview,
      200,
      requestId
    );
  } catch (error) {
    logError("Admin dashboard overview error", error, {
      requestId,
      adminId: req.user.id
    });
    
    if (error.name === "CastError") {
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }
    
    // Handle database connection errors
    if (error.name === "MongoNetworkError" || error.name === "MongoServerSelectionError") {
      return sendErrorResponse(res, 'SYS_002', {}, requestId);
    }
    
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};