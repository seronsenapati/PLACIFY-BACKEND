import mongoose from "mongoose";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import { sendResponse, sendErrorResponse, sendSuccessResponse } from "../utils/sendResponse.js";
import { logInfo, logError } from "../utils/logger.js";
import { v4 as uuidv4 } from 'uuid';

// GET /api/applications/job/:jobId
export const getJobApplications = async (req, res) => {
  const requestId = uuidv4();
  const { jobId } = req.params;
  const { status, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', search } = req.query;

  logInfo('Fetching job applications', {
    requestId,
    jobId,
    recruiterId: req.user.id,
    filters: { status, page, limit, sortBy, order, search }
  });

  try {
    // Role check
    if (req.user.role !== "recruiter") {
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Validate job ID format
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return sendErrorResponse(res, 'JOB_003', {}, requestId);
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return sendErrorResponse(res, 'JOB_001', {}, requestId);
    }

    // Ensure the logged-in recruiter owns this job
    if (job.createdBy.toString() !== req.user.id) {
      return sendErrorResponse(res, 'JOB_002', {}, requestId);
    }

    // Build query filters
    const filter = { job: jobId };
    
    // Status filter
    if (status && ['pending', 'reviewed', 'rejected', 'withdrawn'].includes(status)) {
      filter.status = status;
    }

    // Search filter (search in student name or email)
    let studentMatch = {};
    if (search) {
      studentMatch = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
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

    // Execute queries in parallel
    const [applications, total, jobStats] = await Promise.all([
      Application.find(filter)
        .populate({
          path: "student", 
          select: "name email profile.avatar",
          match: studentMatch
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Application.countDocuments(filter),
      Application.getStatsByJob(jobId)
    ]);

    // Filter out applications where student didn't match search (if searching)
    const filteredApplications = search 
      ? applications.filter(app => app.student) 
      : applications;

    // Enhance applications with additional computed fields
    const enhancedApplications = filteredApplications.map(app => ({
      ...app,
      canReview: app.status === 'pending',
      daysSinceApplication: Math.floor((new Date() - new Date(app.createdAt)) / (1000 * 60 * 60 * 24)),
      // Add a simplified status history for quick view
      latestStatusUpdate: app.statusHistory && app.statusHistory.length > 0 
        ? app.statusHistory[app.statusHistory.length - 1] 
        : null
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
      statistics: jobStats,
      jobDetails: {
        id: job._id,
        title: job.title,
        role: job.role,
        location: job.location,
        createdAt: job.createdAt
      }
    };

    logInfo('Job applications fetched successfully', {
      requestId,
      jobId,
      recruiterId: req.user.id,
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
    logError("Fetch job applications error", error, {
      requestId,
      jobId,
      recruiterId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

/**
 * @desc Export applications for a job to CSV
 * @route GET /api/applications/job/:jobId/export
 * @access Recruiter (only for their own job postings)
 */
export const exportJobApplications = async (req, res) => {
  const requestId = uuidv4();
  const { jobId } = req.params;
  const { status, format = 'csv' } = req.query;

  logInfo('Exporting job applications', {
    requestId,
    jobId,
    recruiterId: req.user.id,
    format,
    status
  });

  try {
    // Validate job ID format
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return sendErrorResponse(res, 'JOB_003', {}, requestId);
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return sendErrorResponse(res, 'JOB_001', {}, requestId);
    }

    // Ensure the logged-in recruiter owns this job
    if (job.createdBy.toString() !== req.user.id) {
      return sendErrorResponse(res, 'JOB_002', {}, requestId);
    }

    // Build query filters
    const filter = { job: jobId };
    if (status && ['pending', 'reviewed', 'rejected', 'withdrawn'].includes(status)) {
      filter.status = status;
    }

    // Fetch all applications for export
    const applications = await Application.find(filter)
      .populate('student', 'name email phone profile.linkedin profile.github')
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'Application ID',
        'Student Name',
        'Email',
        'Phone',
        'Status',
        'Applied Date',
        'Resume URL',
        'LinkedIn',
        'GitHub',
        'Last Updated'
      ];

      const csvRows = applications.map(app => [
        app._id.toString(),
        app.student?.name || 'N/A',
        app.student?.email || 'N/A',
        app.student?.phone || 'N/A',
        app.status,
        new Date(app.createdAt).toISOString().split('T')[0],
        app.resumeUrl || 'N/A',
        app.student?.profile?.linkedin || 'N/A',
        app.student?.profile?.github || 'N/A',
        new Date(app.updatedAt).toISOString().split('T')[0]
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      // Set CSV headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="applications-${job.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.csv"`);
      
      logInfo('Applications exported successfully', {
        requestId,
        jobId,
        recruiterId: req.user.id,
        format,
        exportedCount: applications.length
      });

      return res.send(csvContent);
    } else {
      // Return JSON for other formats
      return sendSuccessResponse(
        res,
        "Applications exported successfully",
        {
          job: {
            id: job._id,
            title: job.title,
            role: job.role
          },
          applications,
          exportedAt: new Date().toISOString(),
          totalCount: applications.length
        },
        200,
        requestId
      );
    }
  } catch (error) {
    logError("Export job applications error", error, {
      requestId,
      jobId,
      recruiterId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};