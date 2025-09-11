import mongoose from "mongoose";
import Job from "../models/Job.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/sendResponse.js";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { v4 as uuidv4 } from 'uuid';
import xss from 'xss';
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";

// Helper function to sanitize input
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return xss(input.trim());
  }
  return input;
};

// Helper function to sanitize array of strings
const sanitizeStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => typeof item === 'string' ? xss(item.trim()) : '').filter(item => item.length > 0);
};

/**
 * @desc Create a new job
 * @route POST /api/jobs
 * @access Recruiter/Admin
 */
export const createJob = async (req, res) => {
  const requestId = uuidv4();
  
  logInfo('Job creation initiated', {
    requestId,
    userId: req.user.id,
    role: req.user.role
  });

  try {
    // Validate user role
    if (req.user.role !== "recruiter" && req.user.role !== "admin") {
      logWarn('Unauthorized job creation attempt', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Get recruiter with settings
    const recruiter = await User.findById(req.user.id);
    if (!recruiter) {
      return sendErrorResponse(res, 'USER_001', {}, requestId);
    }

    // Validate required fields
    const { title, role, desc, location, salary, skills } = req.body;
    
    if (!title || !role || !desc || !location || salary === undefined || !skills) {
      logWarn('Missing required fields for job creation', {
        requestId,
        userId: req.user.id,
        missingFields: !title ? 'title' : !role ? 'role' : !desc ? 'desc' : !location ? 'location' : salary === undefined ? 'salary' : !skills ? 'skills' : null
      });
      return sendErrorResponse(res, 'JOB_001', {
        missingFields: {
          title: !title,
          role: !role,
          desc: !desc,
          location: !location,
          salary: salary === undefined,
          skills: !skills
        }
      }, requestId);
    }

    // Sanitize inputs
    const sanitizedData = {
      title: sanitizeInput(title),
      role: sanitizeInput(role),
      desc: sanitizeInput(desc),
      location: sanitizeInput(location),
      salary: Number(salary),
      skills: sanitizeStringArray(skills),
      createdBy: req.user.id
    };

    // Validate salary
    if (isNaN(sanitizedData.salary) || sanitizedData.salary < 0) {
      return sendErrorResponse(res, 'JOB_002', { field: 'salary' }, requestId);
    }

    // Validate skills array
    if (!Array.isArray(sanitizedData.skills) || sanitizedData.skills.length === 0) {
      return sendErrorResponse(res, 'JOB_002', { field: 'skills' }, requestId);
    }

    // Get company from recruiter
    if (req.user.role === "recruiter") {
      // Check if recruiter has a company
      if (!recruiter.company) {
        // Try to find company by createdBy field as fallback
        const company = await Company.findOne({ createdBy: recruiter._id });
        if (company) {
          // Update recruiter with company reference
          recruiter.company = company._id;
          await recruiter.save();
          logInfo('Recruiter company reference restored', {
            requestId,
            userId: req.user.id,
            companyId: company._id
          });
        } else {
          logWarn('Recruiter does not have a company profile', {
            requestId,
            userId: req.user.id
          });
          return sendErrorResponse(res, 'JOB_004', {
            message: 'Recruiters must create a company profile before posting jobs'
          }, requestId);
        }
      }
      
      // Verify the company exists
      const company = await Company.findById(recruiter.company);
      if (!company) {
        logWarn('Recruiter company not found', {
          requestId,
          userId: req.user.id,
          companyId: recruiter.company
        });
        return sendErrorResponse(res, 'JOB_004', {
          message: 'Recruiter company profile not found'
        }, requestId);
      }
      
      sanitizedData.company = recruiter.company;
    } else if (req.user.role === "admin") {
      // Admin can specify company
      if (!req.body.company) {
        logWarn('Admin did not specify company for job creation', {
          requestId,
          userId: req.user.id
        });
        return sendErrorResponse(res, 'JOB_001', { field: 'company', message: 'Company is required for admin job creation' }, requestId);
      }
      sanitizedData.company = req.body.company;
    }

    // Set default values from recruiter settings if available
    const defaultJobExpirationDays = recruiter.recruiterSettings?.defaultJobExpirationDays || 30;
    const defaultApplicationDeadlineDays = recruiter.recruiterSettings?.defaultApplicationDeadlineDays || 14;
    
    // Set expiration date (default 30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + defaultJobExpirationDays);
    sanitizedData.expiresAt = expiresAt;

    // Set application deadline (default 14 days from now)
    const applicationDeadline = new Date();
    applicationDeadline.setDate(applicationDeadline.getDate() + defaultApplicationDeadlineDays);
    sanitizedData.applicationDeadline = applicationDeadline;

    // Set other default values
    sanitizedData.jobType = req.body.jobType || "internship";
    sanitizedData.status = "active";
    sanitizedData.experienceLevel = req.body.experienceLevel || "entry";
    sanitizedData.isRemote = req.body.isRemote === true;

    // Create job
    const job = new Job(sanitizedData);
    await job.save();

    // Populate company and creator info
    await job.populate([
      { path: 'createdBy', select: 'name email' },
      { path: 'company', select: 'name logo' }
    ]);

    logInfo('Job created successfully', {
      requestId,
      jobId: job._id,
      userId: req.user.id,
      title: job.title
    });

    return sendSuccessResponse(
      res,
      "Job created successfully",
      job,
      201,
      requestId
    );
  } catch (error) {
    logError("Job creation error", error, {
      requestId,
      userId: req.user.id
    });
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return sendErrorResponse(res, 'VALIDATION_001', { errors }, requestId);
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return sendErrorResponse(res, 'JOB_004', {}, requestId);
    }
    
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
      status = "active",
      experienceLevel,
      isRemote,
      companyId
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

    // Experience level filter
    const validExperienceLevels = ["entry", "mid", "senior", "lead"];
    if (experienceLevel && validExperienceLevels.includes(experienceLevel)) {
      filter.experienceLevel = experienceLevel;
    }

    // Remote work filter
    if (isRemote !== undefined) {
      filter.isRemote = isRemote === 'true';
    }

    // Company filter
    if (companyId) {
      filter.company = companyId;
    }

    // Exclude expired jobs unless explicitly requested
    if (status === "active") {
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ];
    }

    // Exclude jobs with passed application deadlines
    filter.$and = [
      {
        $or: [
          { applicationDeadline: { $exists: false } },
          { applicationDeadline: { $gte: new Date() } }
        ]
      }
    ];

    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = order === "asc" ? 1 : -1;
    }

    const totalJobs = await Job.countDocuments(filter);

    const jobs = await Job.find(filter)
      .populate("createdBy", "name email")
      .populate("company", "name logo")
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

    if (sanitizedBody.experienceLevel) {
      const validExperienceLevels = ["entry", "mid", "senior", "lead"];
      if (!validExperienceLevels.includes(sanitizedBody.experienceLevel)) {
        logWarn('Job update failed - invalid experience level', {
          requestId,
          jobId,
          userId: req.user.id,
          experienceLevel: sanitizedBody.experienceLevel
        });
        return sendErrorResponse(res, 'VAL_002', { 
          message: "Invalid experience level",
          validTypes: validExperienceLevels
        }, requestId);
      }
    }

    // If updating company, validate ownership
    if (sanitizedBody.company) {
      const company = await Company.findOne({ 
        _id: sanitizedBody.company,
        createdBy: req.user.id 
      });

      if (!company) {
        logWarn('Job update failed - company not found or not owned by user', {
          requestId,
          jobId,
          userId: req.user.id,
          companyId: sanitizedBody.company
        });
        return sendErrorResponse(res, 'COMPANY_002', {}, requestId);
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

    // Remove job from company's jobs array
    await Company.updateOne(
      { _id: deletedJob.company },
      { $pull: { jobs: jobId } }
    );

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
    const job = await Job.findById(jobId)
      .populate("createdBy", "name email role")
      .populate("company", "name desc website logo");

    if (!job) {
      logWarn('Job not found', {
        requestId,
        jobId,
        userId: req.user?.id
      });
      return sendErrorResponse(res, 'JOB_001', {}, requestId);
    }

    // Check if job is expired and update status if needed
    if (job.expiresAt && job.expiresAt < new Date() && job.status !== 'expired') {
      job.status = 'expired';
      await job.save();
      
      // Create notification for recruiter about job expiration
      try {
        await createJobExpiredNotification(
          job.createdBy._id,
          job.title,
          { jobId: job._id }
        );
      } catch (notificationError) {
        logError('Failed to create job expired notification', notificationError, {
          requestId,
          jobId: job._id,
          recruiterId: job.createdBy._id
        });
        // Don't fail the request if notification fails
      }
    }

    logInfo('Job fetched successfully', {
      requestId,
      jobId,
      userId: req.user?.id,
      status: job.status
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

    // Check if application deadline has passed with more comprehensive validation
    const now = new Date();
    if (job.applicationDeadline) {
      // Ensure application deadline is not in the past
      if (job.applicationDeadline < now) {
        logWarn('Job application failed - application deadline passed', {
          requestId,
          jobId,
          studentId: req.user.id,
          applicationDeadline: job.applicationDeadline,
          currentTime: now
        });
        return sendErrorResponse(res, 'JOB_005', {}, requestId);
      }
      
      // Ensure application deadline is not after job expiration date
      if (job.expiresAt && job.applicationDeadline > job.expiresAt) {
        logWarn('Job application failed - application deadline after job expiration', {
          requestId,
          jobId,
          studentId: req.user.id,
          applicationDeadline: job.applicationDeadline,
          expiresAt: job.expiresAt
        });
        return sendErrorResponse(res, 'VAL_002', { 
          message: "Application deadline cannot be after job expiration date"
        }, requestId);
      }
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

    // Return enhanced response with more application details
    return sendSuccessResponse(
      res,
      "Application submitted successfully",
      {
        application: {
          id: application._id,
          status: application.status,
          submittedAt: application.createdAt,
          resumeUrl: application.resumeUrl,
          coverLetter: application.coverLetter,
          job: {
            id: job._id,
            title: job.title,
            role: job.role,
            company: {
              name: job.createdBy.name
            }
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
      status,
      experienceLevel,
      isRemote
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

    // Experience level filter
    const validExperienceLevels = ["entry", "mid", "senior", "lead"];
    if (experienceLevel && validExperienceLevels.includes(experienceLevel)) {
      filter.experienceLevel = experienceLevel;
    }

    // Remote work filter
    if (isRemote !== undefined) {
      filter.isRemote = isRemote === 'true';
    }

    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = order === "asc" ? 1 : -1;
    }

    const totalJobs = await Job.countDocuments(filter);

    const jobs = await Job.find(filter)
      .populate("createdBy", "name email")
      .populate("company", "name logo")
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
    
    // Get jobs by experience level
    const jobsByExperience = await Job.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: "$experienceLevel",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get jobs by remote work option
    const jobsByRemote = await Job.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: "$isRemote",
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
    
    // Get application statistics by status
    const applicationStats = await Application.aggregate([
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
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get applications over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const applicationsOverTime = await Application.aggregate([
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
          "jobDetails.createdBy": new mongoose.Types.ObjectId(req.user.id),
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
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
      jobsByExperience: jobsByExperience.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      jobsByRemote: jobsByRemote.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentApplications,
      applicationStats: applicationStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      applicationsOverTime
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

// Get bookmarked jobs for student
export const getBookmarkedJobs = async (req, res) => {
  const requestId = uuidv4();
  
  logInfo('Fetching bookmarked jobs', {
    requestId,
    userId: req.user.id
  });

  try {
    if (req.user.role !== "student") {
      logWarn('Non-student user attempted to get bookmarked jobs', {
        requestId,
        userId: req.user.id,
        role: req.user.role
      });
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Ensure bookmarkedJobs is initialized as an array
    if (!Array.isArray(req.user.bookmarkedJobs)) {
      req.user.bookmarkedJobs = [];
    }

    // Get query parameters for sorting and filtering
    const { sortBy = 'createdAt', order = 'desc', search, jobType, location } = req.query;
    
    // Build sort options
    const sortOptions = {};
    const validSortFields = ['createdAt', 'title', 'applicationDeadline'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sortOptions[sortField] = order === 'asc' ? 1 : -1;

    // Build filter for jobs
    const jobFilter = { 
      _id: { $in: req.user.bookmarkedJobs },
      status: "active"
    };

    // Add search filter if provided
    if (search) {
      jobFilter.$or = [
        { title: { $regex: search, $options: "i" } },
        { role: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { desc: { $regex: search, $options: "i" } }
      ];
    }

    // Add job type filter if provided
    if (jobType) {
      jobFilter.jobType = jobType;
    }

    // Add location filter if provided
    if (location) {
      jobFilter.location = { $regex: location, $options: "i" };
    }

    const jobs = await Job.find(jobFilter)
      .populate("createdBy", "name email")
      .populate("company", "name logo")
      .sort(sortOptions)
      .catch(err => {
        logError("Database error when fetching bookmarked jobs", err, {
          requestId,
          userId: req.user.id
        });
        throw new Error('DATABASE_ERROR');
      });

    // Enhance jobs with additional information for dashboard
    const enhancedJobs = jobs.map(job => ({
      ...job.toObject(),
      isBookmarked: true, // All jobs in this list are bookmarked
      daysUntilDeadline: job.applicationDeadline 
        ? Math.ceil((new Date(job.applicationDeadline) - new Date()) / (1000 * 60 * 60 * 24))
        : null,
      isExpiringSoon: job.applicationDeadline 
        ? Math.ceil((new Date(job.applicationDeadline) - new Date()) / (1000 * 60 * 60 * 24)) <= 3
        : false
    }));

    logInfo('Bookmarked jobs fetched successfully', {
      requestId,
      userId: req.user.id,
      count: jobs.length
    });

    return sendSuccessResponse(res, "Bookmarked jobs fetched successfully", enhancedJobs, 200, requestId);
  } catch (error) {
    logError("Get bookmarked jobs error", error, {
      requestId,
      userId: req.user.id
    });
    
    if (error.name === "CastError") {
      return sendErrorResponse(res, 'USER_003', {}, requestId);
    }
    
    // Handle database connection errors
    if (error.name === "MongoNetworkError" || error.name === "MongoServerSelectionError") {
      return sendErrorResponse(res, 'SYS_002', {}, requestId);
    }
    
    // Handle custom database errors
    if (error.message === 'DATABASE_ERROR') {
      return sendErrorResponse(res, 'SYS_001', {}, requestId);
    }
    
    return sendErrorResponse(res, 'SYS_001', {}, requestId);
  }
};