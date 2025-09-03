import mongoose from "mongoose";
import Application from "../models/Application.js";
import { sendResponse, sendErrorResponse, sendSuccessResponse } from "../utils/sendResponse.js";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { v4 as uuidv4 } from 'uuid';

// GET /api/applications/student
export const getStudentApplications = async (req, res) => {
  const requestId = uuidv4();
  const { status, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search } = req.query;

  logInfo('Fetching student applications', {
    requestId,
    studentId: req.user.id,
    filters: { status, page, limit, sortBy, order, search }
  });

  try {
    if (req.user.role !== "student") {
      logWarn('Non-student user attempted to fetch applications', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      logWarn('Invalid user ID format when fetching applications', {
        requestId,
        userId: req.user.id
      });
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }

    // Build query filters
    const filter = { student: req.user.id };
    
    // Status filter
    if (status && ['pending', 'reviewed', 'rejected', 'withdrawn'].includes(status)) {
      filter.status = status;
    }

    // Pagination
    const pageNumber = parseInt(page) || 1;
    const limitNumber = Math.min(parseInt(limit) || 10, 50); // Max 50 per page
    const skip = (pageNumber - 1) * limitNumber;

    // Sorting
    const sortOptions = {};
    const validSortFields = ['createdAt', 'updatedAt', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sortOptions[sortField] = order === 'asc' ? 1 : -1;

    // Build job search filter if provided
    let jobSearchFilter = {};
    if (search) {
      jobSearchFilter = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { role: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Execute queries in parallel
    const [applications, total, studentStats] = await Promise.all([
      Application.find(filter)
        .populate({
          path: "job",
          match: search ? jobSearchFilter : {},
          populate: {
            path: "createdBy",
            select: "name email profile.company", // Recruiter info
          },
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNumber)
        .lean()
        .catch(err => {
          logError("Database error when fetching applications", err, {
            requestId,
            studentId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Application.countDocuments(filter)
        .catch(err => {
          logError("Database error when counting applications", err, {
            requestId,
            studentId: req.user.id
          });
          throw new Error('DATABASE_ERROR');
        }),
      Application.getStatsByStudent(req.user.id)
        .catch(err => {
          logError("Database error when fetching student stats", err, {
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

    // Filter out applications where job didn't match search (if searching)
    const filteredApplications = search 
      ? applications.filter(app => app.job) 
      : applications;

    // Enhance applications with additional computed fields
    const enhancedApplications = filteredApplications.map(app => ({
      ...app,
      canWithdraw: app.status === 'pending',
      daysSinceApplication: Math.floor((new Date() - new Date(app.createdAt)) / (1000 * 60 * 60 * 24)),
      statusHistory: app.statusHistory || [],
      // Add more detailed information for dashboard
      jobDetails: app.job ? {
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

    // Calculate additional dashboard statistics
    const recentApplications = enhancedApplications.slice(0, 5); // Get 5 most recent applications
    
    // Calculate response rate and success metrics
    const totalApplications = studentStats.total || 0;
    const activeApplications = studentStats.pending || 0;
    const reviewedApplications = studentStats.reviewed || 0;
    const rejectedApplications = studentStats.rejected || 0;
    const withdrawnApplications = studentStats.withdrawn || 0;
    
    const responseRate = totalApplications > 0 
      ? ((reviewedApplications + rejectedApplications) / totalApplications * 100).toFixed(1) 
      : 0;
      
    const successRate = (reviewedApplications + rejectedApplications) > 0
      ? (reviewedApplications / (reviewedApplications + rejectedApplications) * 100).toFixed(1)
      : 0;

    const response = {
      applications: enhancedApplications,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber),
        hasNext: pageNumber < Math.ceil(total / limitNumber),
        hasPrev: pageNumber > 1
      },
      filters: {
        status,
        search,
        sortBy: sortField,
        order
      },
      statistics: studentStats,
      summary: {
        totalApplications,
        activeApplications,
        successRate: parseFloat(successRate),
        responseRate: parseFloat(responseRate)
      },
      insights: {
        recentApplications,
        applicationTrends: {
          active: activeApplications,
          reviewed: reviewedApplications,
          rejected: rejectedApplications,
          withdrawn: withdrawnApplications
        }
      }
    };

    logInfo('Student applications fetched successfully', {
      requestId,
      studentId: req.user.id,
      totalApplications: total,
      returnedCount: enhancedApplications.length
    });

    return sendSuccessResponse(
      res,
      "Applications fetched successfully",
      response,
      200,
      requestId
    );
  } catch (error) {
    logError("Fetch student applications error", error, {
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
 * @desc Get application statistics for student dashboard
 * @route GET /api/applications/student/stats
 * @access Student
 */
export const getStudentApplicationStats = async (req, res) => {
  const requestId = uuidv4();
  const { timeframe = '30' } = req.query; // days

  logInfo('Fetching student application statistics', {
    requestId,
    studentId: req.user.id,
    timeframe
  });

  try {
    if (req.user.role !== "student") {
      logWarn('Non-student user attempted to fetch application stats', {
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

    logInfo('Student application statistics generated', {
      requestId,
      studentId: req.user.id,
      timeframeDays: daysBack,
      totalApplications: overallStats.total
    });

    return sendSuccessResponse(
      res,
      "Application statistics retrieved successfully",
      response,
      200,
      requestId
    );
  } catch (error) {
    logError("Student application statistics error", error, {
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