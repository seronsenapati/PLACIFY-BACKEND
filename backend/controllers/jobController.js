import mongoose from "mongoose";
import Job from "../models/Job.js";
import { sendResponse, sendErrorResponse, sendSuccessResponse } from "../utils/sendResponse.js";
import validateFields from "../utils/validateFields.js";
import { validateJobFields } from "../utils/validateAdvancedFields.js";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";
import { createNewApplicationNotification } from "../utils/notificationHelpers.js";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { v4 as uuidv4 } from 'uuid';
import xss from 'xss';

// Create job
export const createJob = async (req, res) => {
  const requestId = uuidv4();
  logInfo('Job creation initiated', {
    requestId,
    userId: req.user.id,
    userRole: req.user.role
  });

  try {
    const { isValid, missingFields } = validateFields(
      ["title", "role", "desc", "location", "salary"],
      req.body
    );

    if (!isValid) {
      logWarn('Job creation failed - missing fields', {
        requestId,
        userId: req.user.id,
        missingFields
      });
      return sendErrorResponse(res, 'VAL_001', { missingFields }, requestId);
    }

    // Sanitize inputs to prevent XSS attacks
    const {
      role,
      desc,
      salary,
      title,
      location,
      skills = [],
      jobType = "internship",
      expiresAt
    } = {
      role: xss(req.body.role),
      desc: xss(req.body.desc),
      salary: req.body.salary,
      title: xss(req.body.title),
      location: xss(req.body.location),
      skills: Array.isArray(req.body.skills) ? req.body.skills.map(skill => xss(skill)) : [],
      jobType: xss(req.body.jobType) || "internship",
      expiresAt: req.body.expiresAt
    };

    const validJobTypes = ["internship", "full-time", "part-time", "contract"];
    if (!validJobTypes.includes(jobType)) {
      logWarn('Job creation failed - invalid job type', {
        requestId,
        userId: req.user.id,
        jobType
      });
      return sendErrorResponse(res, 'VAL_002', { 
        message: "Invalid job type",
        validTypes: validJobTypes
      }, requestId);
    }

    const fieldErrors = validateJobFields({ role, desc, salary });
    if (fieldErrors.length > 0) {
      logWarn('Job creation failed - validation errors', {
        requestId,
        userId: req.user.id,
        fieldErrors
      });
      return sendErrorResponse(res, 'VAL_002', { 
        message: fieldErrors.join(", "),
        fieldErrors
      }, requestId);
    }

    const company = await Company.findOne({ createdBy: req.user.id });

    if (!company) {
      logWarn('Job creation failed - no company found', {
        requestId,
        userId: req.user.id
      });
      return sendErrorResponse(res, 'JOB_004', {}, requestId);
    }

    // Set default expiration date to 30 days from now if not provided
    const jobExpiresAt = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newJob = await Job.create({
      title,
      role,
      desc,
      location,
      salary,
      skills,
      jobType,
      expiresAt: jobExpiresAt,
      createdBy: req.user.id,
    });

    company.jobs.push(newJob._id);
    await company.save();

    logInfo('Job created successfully', {
      requestId,
      jobId: newJob._id,
      userId: req.user.id,
      title: newJob.title
    });

    return sendSuccessResponse(res, "Job created successfully", newJob, 201, requestId);
  } catch (error) {
    logError("Job creation error", error, {
      requestId,
      userId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

// Get All Jobs
export const getAllJobs = async (req, res) => {
  const requestId = uuidv4();
  logInfo('Fetching all jobs', {
    requestId,
    userId: req.user?.id,
    query: req.query
  });

  try {
    const {
      search,
      location,
      role,
      jobType,
      minSalary,
      maxSalary,
      sortBy,
      order,
      page = 1,
      limit = 10,
      status = "active"
    } = req.query;

    const filter = { status };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { role: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    if (location) filter.location = location;
    if (role) filter.role = role;

    const validJobTypes = ["internship", "full-time", "part-time", "contract"];
    if (jobType && validJobTypes.includes(jobType)) {
      filter.jobType = jobType;
    }

    if (minSalary || maxSalary) {
      filter.salary = {};
      if (minSalary) filter.salary.$gte = Number(minSalary);
      if (maxSalary) filter.salary.$lte = Number(maxSalary);
    }

    // Exclude expired jobs unless explicitly requested
    if (status === "active") {
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ];
    }

    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = order === "asc" ? 1 : -1;
    }

    const totalJobs = await Job.countDocuments(filter);

    const jobs = await Job.find(filter)
      .populate("createdBy", "name email")
      .sort(sortOptions || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    logInfo('Jobs fetched successfully', {
      requestId,
      totalJobs,
      currentPage: Number(page),
      totalPages: Math.ceil(totalJobs / limit)
    });

    return sendSuccessResponse(res, "Jobs fetched successfully", {
      jobs,
      totalJobs,
      totalPages: Math.ceil(totalJobs / limit),
      currentPage: Number(page),
    }, 200, requestId);
  } catch (error) {
    logError("Get all jobs error", error, {
      requestId,
      userId: req.user?.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

// Update a Job
export const updateJob = async (req, res) => {
  const requestId = uuidv4();
  const jobId = req.params.id;
  
  logInfo('Job update initiated', {
    requestId,
    jobId,
    userId: req.user.id
  });

  try {
    // Sanitize inputs to prevent XSS attacks
    const sanitizedBody = {};
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        sanitizedBody[key] = xss(req.body[key]);
      } else if (Array.isArray(req.body[key])) {
        sanitizedBody[key] = req.body[key].map(item => typeof item === 'string' ? xss(item) : item);
      } else {
        sanitizedBody[key] = req.body[key];
      }
    }

    if (sanitizedBody.jobType) {
      const validJobTypes = [
        "internship",
        "full-time",
        "part-time",
        "contract",
      ];
      if (!validJobTypes.includes(sanitizedBody.jobType)) {
        logWarn('Job update failed - invalid job type', {
          requestId,
          jobId,
          userId: req.user.id,
          jobType: sanitizedBody.jobType
        });
        return sendErrorResponse(res, 'VAL_002', { 
          message: "Invalid job type",
          validTypes: validJobTypes
        }, requestId);
      }
    }

    const updatedJob = await Job.findOneAndUpdate(
      { _id: jobId, createdBy: req.user.id },
      sanitizedBody,
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      logWarn('Job update failed - not authorized or job not found', {
        requestId,
        jobId,
        userId: req.user.id
      });
      return sendErrorResponse(res, 'JOB_002', {}, requestId);
    }

    logInfo('Job updated successfully', {
      requestId,
      jobId,
      userId: req.user.id,
      updatedFields: Object.keys(sanitizedBody)
    });

    return sendSuccessResponse(res, "Job updated successfully", updatedJob, 200, requestId);
  } catch (error) {
    logError("Job update error", error, {
      requestId,
      jobId,
      userId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

// Delete Job
export const deleteJob = async (req, res) => {
  const requestId = uuidv4();
  const jobId = req.params.id;
  
  logInfo('Job deletion initiated', {
    requestId,
    jobId,
    userId: req.user.id
  });

  try {
    const deletedJob = await Job.findOneAndDelete({
      _id: jobId,
      createdBy: req.user.id,
    });

    if (!deletedJob) {
      logWarn('Job deletion failed - not authorized or job not found', {
        requestId,
        jobId,
        userId: req.user.id
      });
      return sendErrorResponse(res, 'JOB_002', {}, requestId);
    }

    logInfo('Job deleted successfully', {
      requestId,
      jobId,
      userId: req.user.id
    });

    return sendSuccessResponse(res, "Job deleted successfully", null, 200, requestId);
  } catch (error) {
    logError("Job deletion error", error, {
      requestId,
      jobId,
      userId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

// Get Job by ID
export const getJobById = async (req, res) => {
  const requestId = uuidv4();
  const jobId = req.params.id;
  
  logInfo('Fetching job by ID', {
    requestId,
    jobId,
    userId: req.user?.id
  });

  try {
    const job = await Job.findById(jobId).populate(
      "createdBy",
      "name email role"
    );

    if (!job) {
      logWarn('Job not found', {
        requestId,
        jobId,
        userId: req.user?.id
      });
      return sendErrorResponse(res, 'JOB_001', {}, requestId);
    }

    // Check if job is expired
    if (job.expiresAt && job.expiresAt < new Date() && job.status !== 'expired') {
      job.status = 'expired';
      await job.save();
    }

    logInfo('Job fetched successfully', {
      requestId,
      jobId,
      userId: req.user?.id
    });

    return sendSuccessResponse(res, "Job fetched successfully", job, 200, requestId);
  } catch (error) {
    logError("Get job by ID error", error, {
      requestId,
      jobId,
      userId: req.user?.id
    });

    if (error.name === "CastError") {
      return sendErrorResponse(res, 'JOB_003', {}, requestId);
    }

    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

// Apply for a Job
export const applyToJob = async (req, res) => {
  const requestId = uuidv4();
  const { jobId } = req.params;
  const { coverLetter } = req.body;

  logInfo('Job application initiated', {
    requestId,
    jobId,
    studentId: req.user.id,
    hasResume: !!req.file,
    resumeSize: req.file?.size,
    resumeType: req.file?.mimetype
  });

  try {
    if (req.user.role !== "student") {
      logWarn('Job application failed - user not a student', {
        requestId,
        jobId,
        userId: req.user.id,
        userRole: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Check if resume file is provided
    if (!req.file) {
      logWarn('Job application failed - no resume provided', {
        requestId,
        jobId,
        studentId: req.user.id
      });
      return sendErrorResponse(res, 'APP_005', {}, requestId);
    }

    // Validate file type
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      logWarn('Job application failed - invalid file type', {
        requestId,
        jobId,
        studentId: req.user.id,
        fileType: req.file.mimetype
      });
      return sendErrorResponse(res, 'VAL_003', { 
        allowedTypes: 'PDF, DOCX',
        receivedType: req.file.mimetype 
      }, requestId);
    }

    // Validate file size (10MB limit)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxFileSize) {
      logWarn('Job application failed - file too large', {
        requestId,
        jobId,
        studentId: req.user.id,
        fileSize: req.file.size
      });
      return sendErrorResponse(res, 'VAL_004', { 
        maxSize: '10MB',
        receivedSize: Math.round(req.file.size / 1024 / 1024 * 100) / 100 + 'MB'
      }, requestId);
    }

    // Validate job ID
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      logWarn('Job application failed - invalid job ID', {
        requestId,
        jobId,
        studentId: req.user.id
      });
      return sendErrorResponse(res, 'JOB_003', {}, requestId);
    }

    const job = await Job.findById(jobId).populate("createdBy");
    if (!job) {
      logWarn('Job application failed - job not found', {
        requestId,
        jobId,
        studentId: req.user.id
      });
      return sendErrorResponse(res, 'JOB_001', {}, requestId);
    }

    // Check if job is expired
    if (job.expiresAt && job.expiresAt < new Date()) {
      logWarn('Job application failed - job expired', {
        requestId,
        jobId,
        studentId: req.user.id,
        expiresAt: job.expiresAt
      });
      return sendErrorResponse(res, 'JOB_001', { 
        message: "This job has expired and is no longer accepting applications"
      }, requestId);
    }

    const alreadyApplied = await Application.findOne({
      job: jobId,
      student: req.user.id,
    });

    if (alreadyApplied) {
      logWarn('Job application failed - already applied', {
        requestId,
        jobId,
        studentId: req.user.id,
        applicationId: alreadyApplied._id
      });
      return sendErrorResponse(res, 'APP_002', { 
        applicationId: alreadyApplied._id,
        applicationDate: alreadyApplied.createdAt
      }, requestId);
    }

    // Upload resume to Cloudinary
    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "raw",
            folder: "placify_resumes",
            public_id: `resume_${req.user.id}_${jobId}_${Date.now()}`,
            use_filename: true,
            unique_filename: false,
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    let uploadResult;
    try {
      uploadResult = await streamUpload();
    } catch (uploadError) {
      logError('Resume upload failed', uploadError, {
        requestId,
        jobId,
        studentId: req.user.id
      });
      return sendErrorResponse(res, 'FILE_001', {}, requestId);
    }

    // Create application with enhanced metadata
    const application = await Application.create({
      job: jobId,
      student: req.user.id,
      resumeUrl: uploadResult.secure_url,
      resumeFileName: req.file.originalname,
      resumeFileSize: req.file.size,
      coverLetter: coverLetter ? xss(coverLetter.trim()) : undefined,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'web'
      }
    });

    logInfo('Application submitted successfully', {
      requestId,
      applicationId: application._id,
      jobId,
      studentId: req.user.id,
      jobTitle: job.title,
      resumeUrl: uploadResult.secure_url
    });

    // Create notification for the recruiter using helper
    try {
      await createNewApplicationNotification(
        job.createdBy._id,
        job.title,
        req.user.name || 'Unknown User',
        {
          applicationId: application._id,
          jobId: job._id,
          studentId: req.user.id
        }
      );
    } catch (notificationError) {
      logError('Failed to create application notification', notificationError, {
        requestId,
        applicationId: application._id,
        recruiterId: job.createdBy._id
      });
      // Don't fail the request if notification fails
    }

    return sendSuccessResponse(
      res,
      "Application submitted successfully",
      {
        application: {
          id: application._id,
          status: application.status,
          submittedAt: application.createdAt,
          job: {
            id: job._id,
            title: job.title,
            role: job.role,
            company: job.createdBy.name
          }
        }
      },
      201,
      requestId
    );
  } catch (error) {
    logError("Job application error", error, {
      requestId,
      jobId,
      studentId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

// Get jobs posted by recruiter
export const getRecruiterJobs = async (req, res) => {
  const requestId = uuidv4();
  
  logInfo('Fetching recruiter jobs', {
    requestId,
    userId: req.user.id
  });

  try {
    const {
      search,
      location,
      role,
      jobType,
      minSalary,
      maxSalary,
      sortBy,
      order,
      page = 1,
      limit = 10,
      status
    } = req.query;

    const filter = { createdBy: req.user.id };

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { role: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    if (location) filter.location = location;
    if (role) filter.role = role;

    const validJobTypes = ["internship", "full-time", "part-time", "contract"];
    if (jobType && validJobTypes.includes(jobType)) {
      filter.jobType = jobType;
    }

    if (minSalary || maxSalary) {
      filter.salary = {};
      if (minSalary) filter.salary.$gte = Number(minSalary);
      if (maxSalary) filter.salary.$lte = Number(maxSalary);
    }

    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = order === "asc" ? 1 : -1;
    }

    const totalJobs = await Job.countDocuments(filter);

    const jobs = await Job.find(filter)
      .populate("createdBy", "name email")
      .sort(sortOptions || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    logInfo('Recruiter jobs fetched successfully', {
      requestId,
      userId: req.user.id,
      totalJobs,
      currentPage: Number(page),
      totalPages: Math.ceil(totalJobs / limit)
    });

    return sendSuccessResponse(res, "Jobs fetched successfully", {
      jobs,
      totalJobs,
      totalPages: Math.ceil(totalJobs / limit),
      currentPage: Number(page),
    }, 200, requestId);
  } catch (error) {
    logError("Get recruiter jobs error", error, {
      requestId,
      userId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};

// Get job statistics for recruiter
export const getJobStats = async (req, res) => {
  const requestId = uuidv4();
  
  logInfo('Fetching job statistics', {
    requestId,
    userId: req.user.id
  });

  try {
    // Get total jobs posted by recruiter
    const totalJobs = await Job.countDocuments({ createdBy: req.user.id });
    
    // Get jobs by status
    const jobsByStatus = await Job.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get jobs by type
    const jobsByType = await Job.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: "$jobType",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get recent applications for recruiter's jobs
    const recentApplications = await Application.aggregate([
      {
        $lookup: {
          from: "jobs",
          localField: "job",
          foreignField: "_id",
          as: "jobDetails"
        }
      },
      {
        $match: {
          "jobDetails.createdBy": new mongoose.Types.ObjectId(req.user.id)
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: "users",
          localField: "student",
          foreignField: "_id",
          as: "studentDetails"
        }
      },
      {
        $project: {
          job: 1,
          status: 1,
          createdAt: 1,
          "jobDetails.title": 1,
          "studentDetails.name": 1,
          "studentDetails.email": 1
        }
      }
    ]);

    const stats = {
      totalJobs,
      jobsByStatus: jobsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      jobsByType: jobsByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentApplications
    };

    logInfo('Job statistics fetched successfully', {
      requestId,
      userId: req.user.id,
      stats
    });

    return sendSuccessResponse(res, "Job statistics fetched successfully", stats, 200, requestId);
  } catch (error) {
    logError("Get job statistics error", error, {
      requestId,
      userId: req.user.id
    });
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};