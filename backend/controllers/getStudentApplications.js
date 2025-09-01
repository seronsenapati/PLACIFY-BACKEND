import mongoose from "mongoose";
import Application from "../models/Application.js";
import { sendResponse, sendErrorResponse, sendSuccessResponse } from "../utils/sendResponse.js";
import { logInfo, logError } from "../utils/logger.js";
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
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Optional: validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
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
        .lean(),
      Application.countDocuments(filter),
      Application.getStatsByStudent(req.user.id)
    ]);

    // Filter out applications where job didn't match search (if searching)
    const filteredApplications = search 
      ? applications.filter(app => app.job) 
      : applications;

    // Enhance applications with additional computed fields
    const enhancedApplications = filteredApplications.map(app => ({
      ...app,
      canWithdraw: app.status === 'pending',
      daysSinceApplication: Math.floor((new Date() - new Date(app.createdAt)) / (1000 * 60 * 60 * 24)),
      statusHistory: app.statusHistory || []
    }));

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
        totalApplications: total,
        activeApplications: studentStats.pending || 0,
        successRate: total > 0 ? ((studentStats.reviewed || 0) / total * 100).toFixed(1) : 0
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
      Application.aggregate(pipeline),
      Application.getStatsByStudent(req.user.id)
    ]);

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
        activeApplications: overallStats.pending || 0
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
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};
