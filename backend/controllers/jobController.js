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
import { logInfo, logError } from "../utils/logger.js";
import { v4 as uuidv4 } from 'uuid';

// Create job
export const createJob = async (req, res) => {
  try {
    const { isValid, missingFields } = validateFields(
      ["title", "role", "desc", "location", "salary"],
      req.body
    );

    if (!isValid) {
      return sendResponse(
        res,
        400,
        false,
        `Missing required fields: ${missingFields.join(", ")}`
      );
    }

    const {
      role,
      desc,
      salary,
      title,
      location,
      skills = [],
      jobType = "internship",
    } = req.body;

    const validJobTypes = ["internship", "full-time", "part-time", "contract"];
    if (!validJobTypes.includes(jobType)) {
      return sendResponse(res, 400, false, "Invalid job type");
    }

    const fieldErrors = validateJobFields({ role, desc, salary });
    if (fieldErrors.length > 0) {
      return sendResponse(res, 400, false, fieldErrors.join(", "));
    }

    const company = await Company.findOne({ createdBy: req.user.id });

    if (!company) {
      return sendResponse(
        res,
        400,
        false,
        "Recruiter has not created a company yet."
      );
    }

    const newJob = await Job.create({
      title,
      role,
      desc,
      location,
      salary,
      skills,
      jobType,
      createdBy: req.user.id,
    });

    company.jobs.push(newJob._id);
    await company.save();

    return sendResponse(res, 201, true, "Job created successfully", newJob);
  } catch (error) {
    console.error("[CreateJob] Error:", error.message);
    return sendResponse(res, 500, false, "Server error");
  }
};

// Get All Jobs
export const getAllJobs = async (req, res) => {
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
    } = req.query;

    const filter = {};

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

    return sendResponse(res, 200, true, "Jobs fetched successfully", {
      jobs,
      totalJobs,
      totalPages: Math.ceil(totalJobs / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("[GetAllJobs] Error:", error.message);
    return sendResponse(res, 500, false, "Server error");
  }
};

// Update a Job
export const updateJob = async (req, res) => {
  try {
    const jobId = req.params.id;

    if (req.body.jobType) {
      const validJobTypes = [
        "internship",
        "full-time",
        "part-time",
        "contract",
      ];
      if (!validJobTypes.includes(req.body.jobType)) {
        return sendResponse(res, 400, false, "Invalid job type");
      }
    }

    const updatedJob = await Job.findOneAndUpdate(
      { _id: jobId, createdBy: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      return sendResponse(res, 403, false, "Not authorized or job not found");
    }

    return sendResponse(res, 200, true, "Job updated successfully", updatedJob);
  } catch (error) {
    console.error("[UpdateJob] Error:", error.message);
    return sendResponse(res, 500, false, "Server error");
  }
};

// Delete Job
export const deleteJob = async (req, res) => {
  try {
    const jobId = req.params.id;

    const deletedJob = await Job.findOneAndDelete({
      _id: jobId,
      createdBy: req.user.id,
    });

    if (!deletedJob) {
      return sendResponse(res, 403, false, "Not authorized or job not found");
    }

    return sendResponse(res, 200, true, "Job deleted successfully");
  } catch (error) {
    console.error("[DeleteJob] Error:", error.message);
    return sendResponse(res, 500, false, "Server error");
  }
};

// Get Job by ID
export const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      "createdBy",
      "name email role"
    );

    if (!job) {
      return sendResponse(res, 404, false, "Job not found");
    }

    return sendResponse(res, 200, true, "Job fetched successfully", job);
  } catch (error) {
    console.error("[GetJobById] Error:", error.message);

    if (error.name === "CastError") {
      return sendResponse(res, 400, false, "Invalid job ID");
    }

    return sendResponse(res, 500, false, "Server error");
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
      return sendErrorResponse(res, 'AUTH_005', {}, requestId);
    }

    // Check if resume file is provided
    if (!req.file) {
      return sendErrorResponse(res, 'APP_005', {}, requestId);
    }

    // Validate file type
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return sendErrorResponse(res, 'VAL_003', { 
        allowedTypes: 'PDF, DOCX',
        receivedType: req.file.mimetype 
      }, requestId);
    }

    // Validate file size (10MB limit)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxFileSize) {
      return sendErrorResponse(res, 'VAL_004', { 
        maxSize: '10MB',
        receivedSize: Math.round(req.file.size / 1024 / 1024 * 100) / 100 + 'MB'
      }, requestId);
    }

    // Validate job ID
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return sendErrorResponse(res, 'JOB_003', {}, requestId);
    }

    const job = await Job.findById(jobId).populate("createdBy");
    if (!job) {
      return sendErrorResponse(res, 'JOB_001', {}, requestId);
    }

    const alreadyApplied = await Application.findOne({
      job: jobId,
      student: req.user.id,
    });

    if (alreadyApplied) {
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
      coverLetter: coverLetter?.trim(),
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
