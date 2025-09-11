import Company from "../models/Company.js";
import User from "../models/User.js";
import sendResponse from "../utils/sendResponse.js";
import validateFields from "../utils/validateFields.js";
import { validateCompanyFields } from "../utils/validateAdvancedFields.js";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { getErrorByCode } from "../utils/errorCodes.js";
import mongoose from "mongoose";

// POST - Create a new company
export const createCompany = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Company creation initiated", {
      requestId,
      userId: req.user.id,
      userRole: req.user.role
    });
    
    if (req.user.role !== "recruiter") {
      logWarn("Non-recruiter attempted to create company", {
        requestId,
        userId: req.user.id,
        userRole: req.user.role
      });
      
      return sendResponse(
        res,
        403,
        false,
        "Only recruiters can post companies",
        null,
        requestId
      );
    }

    // Validate required fields
    const { isValid, missingFields } = validateFields(
      ["name", "desc", "website"],
      req.body
    );

    if (!isValid) {
      logWarn("Company creation failed - missing required fields", {
        requestId,
        userId: req.user.id,
        missingFields
      });
      
      return sendResponse(
        res,
        400,
        false,
        `Missing required fields: ${missingFields.join(", ")}`,
        null,
        requestId
      );
    }

    const { name, desc, website, location, industry, size, employeeCount, socialMedia } = req.body;

    // Validate field formats
    const fieldErrors = validateCompanyFields({ website, socialMedia });
    if (fieldErrors.length > 0) {
      logWarn("Company creation failed - validation errors", {
        requestId,
        userId: req.user.id,
        fieldErrors
      });
      
      return sendResponse(
        res,
        400,
        false,
        fieldErrors.join(", "),
        null,
        requestId
      );
    }

    // Check if company with this name already exists
    const existingCompany = await Company.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingCompany) {
      logWarn("Company creation failed - company name already exists", {
        requestId,
        userId: req.user.id,
        companyName: name
      });
      
      return sendResponse(
        res,
        409,
        false,
        "A company with this name already exists",
        null,
        requestId
      );
    }

    let logoUrl = "";

    if (req.file) {
      logInfo("Processing company logo upload", {
        requestId,
        userId: req.user.id,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });
      
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_logos",
              resource_type: "image",
            },
            (error, result) => {
              if (result) {
                logInfo("Company logo uploaded successfully", {
                  requestId,
                  userId: req.user.id,
                  cloudinaryId: result.public_id
                });
                resolve(result);
              } else {
                logError("Company logo upload failed", error, {
                  requestId,
                  userId: req.user.id
                });
                reject(error);
              }
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };

      try {
        const result = await streamUpload(req.file.buffer);
        logoUrl = result.secure_url;
      } catch (uploadError) {
        logError("Company logo upload failed", uploadError, {
          requestId,
          userId: req.user.id
        });
        
        return sendResponse(
          res,
          500,
          false,
          "Failed to upload company logo",
          null,
          requestId
        );
      }
    }

    // Validate createdBy field as a MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      logError("Invalid createdBy field - not a valid ObjectId", {
        requestId,
        userId: req.user.id
      });
      
      return sendResponse(
        res,
        400,
        false,
        "Invalid user ID format",
        null,
        requestId
      );
    }

    const companyData = {
      name,
      desc,
      website,
      logo: logoUrl,
      createdBy: req.user.id,
    };

    // Add optional fields if provided
    if (location) companyData.location = location;
    if (industry) companyData.industry = industry;
    if (size) companyData.size = size;
    if (employeeCount !== undefined && employeeCount !== null) companyData.employeeCount = employeeCount;
    if (socialMedia) companyData.socialMedia = socialMedia;

    logInfo("Creating company with data", {
      requestId,
      userId: req.user.id,
      companyData: {
        ...companyData,
        // Don't log sensitive data like the actual user ID
        createdBy: typeof companyData.createdBy
      }
    });

    const company = await Company.create(companyData);
    
    // Update the user's company field to link to this company
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.user.id, 
        { company: company._id },
        { new: true, runValidators: true }
      );
      
      if (!updatedUser) {
        logWarn("Failed to update user with company reference - user not found", {
          requestId,
          userId: req.user.id,
          companyId: company._id
        });
        
        // Delete the company since we couldn't associate it with the user
        await Company.findByIdAndDelete(company._id);
        
        return sendResponse(
          res,
          500,
          false,
          "Failed to associate company with user",
          null,
          requestId
        );
      }
      
      logInfo("User updated with company reference", {
        requestId,
        userId: req.user.id,
        companyId: company._id
      });
    } catch (updateError) {
      logError("Failed to update user with company reference", updateError, {
        requestId,
        userId: req.user.id,
        companyId: company._id
      });
      
      // Delete the company since we couldn't associate it with the user
      await Company.findByIdAndDelete(company._id);
      
      return sendResponse(
        res,
        500,
        false,
        "Failed to associate company with user",
        null,
        requestId
      );
    }

    // Log activity
    await company.logActivity("created", req.user.id);

    logInfo("Company created successfully", {
      requestId,
      userId: req.user.id,
      companyId: company._id,
      companyName: company.name
    });

    return sendResponse(
      res,
      201,
      true,
      "Company created successfully",
      company,
      requestId
    );
  } catch (error) {
    logError("Company creation failed", error, {
      requestId,
      userId: req.user.id,
      errorMessage: error.message,
      errorStack: error.stack
    });
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return sendResponse(
        res,
        409,
        false,
        "A company with this name already exists",
        null,
        requestId
      );
    }
    
    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return sendResponse(
        res,
        400,
        false,
        `Validation error: ${validationErrors.join(', ')}`,
        null,
        requestId
      );
    }
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during company creation",
      null,
      requestId
    );
  }
};

// GET - Fetch all companies with their jobs
export const getAllCompanies = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Fetching all companies", {
      requestId,
      userId: req.user?.id || 'anonymous'
    });
    
    // Build query based on filters
    const query = {};
    
    // Apply filters if provided
    if (req.query.industry) {
      query.industry = req.query.industry;
    }
    
    if (req.query.location) {
      query.location = { $regex: new RegExp(req.query.location, 'i') };
    }
    
    if (req.query.verified === 'true') {
      query.isVerified = true;
    } else if (req.query.verified === 'false') {
      query.isVerified = false;
    }
    
    // Build sort object
    const sort = {};
    if (req.query.sortBy) {
      if (req.query.sortBy === 'name') {
        sort.name = req.query.sortOrder === 'desc' ? -1 : 1;
      } else if (req.query.sortBy === 'createdAt') {
        sort.createdAt = req.query.sortOrder === 'desc' ? -1 : 1;
      } else if (req.query.sortBy === 'profileCompleteness') {
        sort.profileCompleteness = req.query.sortOrder === 'desc' ? -1 : 1;
      } else if (req.query.sortBy === 'averageRating') {
        sort.averageRating = req.query.sortOrder === 'desc' ? -1 : 1;
      }
    } else {
      sort.createdAt = -1; // Default sort by newest
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const companies = await Company.find(query)
      .populate("jobs", "title location salary")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Company.countDocuments(query);
    
    const response = {
      companies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    logInfo("Companies fetched successfully", {
      requestId,
      userId: req.user?.id || 'anonymous',
      count: companies.length,
      total,
      page,
      limit
    });

    return sendResponse(
      res,
      200,
      true,
      "Companies fetched successfully",
      response,
      requestId
    );
  } catch (error) {
    logError("Fetching all companies failed", error, {
      requestId,
      userId: req.user?.id || 'anonymous'
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during companies fetch",
      null,
      requestId
    );
  }
};

// GET - Company by ID
export const getCompanyById = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Fetching company by ID", {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.id
    });
    
    const company = await Company.findById(req.params.id)
      .populate("jobs", "title location salary jobType experienceLevel isRemote createdAt");

    if (!company) {
      logWarn("Company not found", {
        requestId,
        userId: req.user?.id || 'anonymous',
        companyId: req.params.id
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Company not found",
        null,
        requestId
      );
    }

    logInfo("Company fetched successfully", {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: company._id
    });

    return sendResponse(
      res,
      200,
      true,
      "Company fetched successfully",
      company,
      requestId
    );
  } catch (error) {
    logError("Fetching company by ID failed", error, {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.id
    });

    if (error.name === "CastError") {
      return sendResponse(
        res,
        400,
        false,
        "Invalid company ID format",
        null,
        requestId
      );
    }

    return sendResponse(
      res,
      500,
      false,
      "Server error during company fetch",
      null,
      requestId
    );
  }
};

// PATCH - Update a company by ID
export const updateCompanyById = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Company update initiated", {
      requestId,
      userId: req.user.id,
      companyId: req.params.id
    });
    
    const company = await Company.findById(req.params.id);

    if (!company) {
      logWarn("Company update failed - company not found", {
        requestId,
        userId: req.user.id,
        companyId: req.params.id
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Company not found",
        null,
        requestId
      );
    }

    // Only recruiter who created it or admin can update
    if (
      req.user.role !== "admin" &&
      company.createdBy.toString() !== req.user.id
    ) {
      logWarn("Company update failed - unauthorized", {
        requestId,
        userId: req.user.id,
        companyId: req.params.id,
        companyCreator: company.createdBy,
        userRole: req.user.role
      });
      
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to update this company",
        null,
        requestId
      );
    }

    const { name, desc, website, location, industry, size, employeeCount, socialMedia } = req.body;

    if (website || socialMedia) {
      const fieldErrors = validateCompanyFields({ website, socialMedia });
      if (fieldErrors.length > 0) {
        logWarn("Company update failed - validation errors", {
          requestId,
          userId: req.user.id,
          companyId: req.params.id,
          fieldErrors
        });
        
        return sendResponse(
          res,
          400,
          false,
          fieldErrors.join(", "),
          null,
          requestId
        );
      }
    }
    
    // Check if company with this name already exists (but not the same company)
    if (name && name !== company.name) {
      const existingCompany = await Company.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: company._id }
      });
      
      if (existingCompany) {
        logWarn("Company update failed - company name already exists", {
          requestId,
          userId: req.user.id,
          companyId: req.params.id,
          companyName: name
        });
        
        return sendResponse(
          res,
          409,
          false,
          "A company with this name already exists",
          null,
          requestId
        );
      }
    }

    let logoUpdated = false;
    
    // Upload logo if new file is provided
    if (req.file) {
      logInfo("Processing company logo update", {
        requestId,
        userId: req.user.id,
        companyId: req.params.id,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });
      
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_logos",
              resource_type: "image",
            },
            (error, result) => {
              if (result) {
                logInfo("Company logo updated successfully", {
                  requestId,
                  userId: req.user.id,
                  companyId: req.params.id,
                  cloudinaryId: result.public_id
                });
                resolve(result);
              } else {
                logError("Company logo update failed", error, {
                  requestId,
                  userId: req.user.id,
                  companyId: req.params.id
                });
                reject(error);
              }
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };

      try {
        const result = await streamUpload(req.file.buffer);
        company.logo = result.secure_url;
        logoUpdated = true;
      } catch (uploadError) {
        logError("Company logo update failed", uploadError, {
          requestId,
          userId: req.user.id,
          companyId: req.params.id
        });
        
        return sendResponse(
          res,
          500,
          false,
          "Failed to upload company logo",
          null,
          requestId
        );
      }
    }

    // Update provided fields
    if (name !== undefined) company.name = name;
    if (desc !== undefined) company.desc = desc;
    if (website !== undefined) company.website = website;
    if (location !== undefined) company.location = location;
    if (industry !== undefined) company.industry = industry;
    if (size !== undefined) company.size = size;
    if (employeeCount !== undefined) company.employeeCount = employeeCount;
    
    // Handle social media updates
    if (socialMedia !== undefined) {
      if (!company.socialMedia) {
        company.socialMedia = {};
      }
      
      if (socialMedia.linkedin !== undefined) company.socialMedia.linkedin = socialMedia.linkedin;
      if (socialMedia.twitter !== undefined) company.socialMedia.twitter = socialMedia.twitter;
      if (socialMedia.facebook !== undefined) company.socialMedia.facebook = socialMedia.facebook;
      if (socialMedia.instagram !== undefined) company.socialMedia.instagram = socialMedia.instagram;
    }

    logInfo("Updating company with data", {
      requestId,
      userId: req.user.id,
      companyId: company._id,
      updateData: {
        name: name !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]",
        desc: desc !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]",
        website: website !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]",
        location: location !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]",
        industry: industry !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]",
        size: size !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]",
        employeeCount: employeeCount !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]",
        socialMedia: socialMedia !== undefined ? "[PROVIDED]" : "[NOT_PROVIDED]"
      }
    });

    await company.save();
    
    // Log activity
    if (logoUpdated) {
      await company.logActivity("logo_updated", req.user.id);
    } else {
      await company.logActivity("updated", req.user.id);
    }

    logInfo("Company updated successfully", {
      requestId,
      userId: req.user.id,
      companyId: company._id,
      companyName: company.name
    });

    return sendResponse(
      res,
      200,
      true,
      "Company updated successfully",
      company,
      requestId
    );
  } catch (error) {
    logError("Company update failed", error, {
      requestId,
      userId: req.user.id,
      companyId: req.params.id,
      errorMessage: error.message,
      errorStack: error.stack
    });
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return sendResponse(
        res,
        409,
        false,
        "A company with this name already exists",
        null,
        requestId
      );
    }
    
    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return sendResponse(
        res,
        400,
        false,
        `Validation error: ${validationErrors.join(', ')}`,
        null,
        requestId
      );
    }
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during company update",
      null,
      requestId
    );
  }
};

// DELETE - Delete a company by ID
export const deleteCompanyById = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Company deletion initiated", {
      requestId,
      userId: req.user.id,
      companyId: req.params.id
    });
    
    const company = await Company.findById(req.params.id);

    if (!company) {
      logWarn("Company deletion failed - company not found", {
        requestId,
        userId: req.user.id,
        companyId: req.params.id
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Company not found",
        null,
        requestId
      );
    }

    // Only admin or the recruiter who created it can delete
    if (
      req.user.role !== "admin" &&
      company.createdBy.toString() !== req.user.id
    ) {
      logWarn("Company deletion failed - unauthorized", {
        requestId,
        userId: req.user.id,
        companyId: req.params.id,
        companyCreator: company.createdBy,
        userRole: req.user.role
      });
      
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to delete this company",
        null,
        requestId
      );
    }

    // Check if company has jobs
    if (company.jobs && company.jobs.length > 0) {
      logWarn("Company deletion failed - company has associated jobs", {
        requestId,
        userId: req.user.id,
        companyId: req.params.id,
        jobCount: company.jobs.length
      });
      
      return sendResponse(
        res,
        400,
        false,
        "Cannot delete company with associated jobs. Please delete jobs first.",
        null,
        requestId
      );
    }

    // Remove company reference from user
    await User.findByIdAndUpdate(company.createdBy, { $unset: { company: "" } });

    await Company.findByIdAndDelete(req.params.id);

    logInfo("Company deleted successfully", {
      requestId,
      userId: req.user.id,
      companyId: req.params.id,
      companyName: company.name
    });

    return sendResponse(
      res,
      200,
      true,
      "Company deleted successfully",
      null,
      requestId
    );
  } catch (error) {
    logError("Company deletion failed", error, {
      requestId,
      userId: req.user.id,
      companyId: req.params.id
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during company deletion",
      null,
      requestId
    );
  }
};

// GET - Company statistics
export const getCompanyStats = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Fetching company statistics", {
      requestId,
      userId: req.user?.id || 'anonymous'
    });
    
    const stats = await Company.getStats();
    
    logInfo("Company statistics fetched successfully", {
      requestId,
      userId: req.user?.id || 'anonymous',
      stats
    });

    return sendResponse(
      res,
      200,
      true,
      "Company statistics fetched successfully",
      stats,
      requestId
    );
  } catch (error) {
    logError("Fetching company statistics failed", error, {
      requestId,
      userId: req.user?.id || 'anonymous'
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during statistics fetch",
      null,
      requestId
    );
  }
};

// GET - Company analytics
export const getCompanyAnalytics = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Fetching company analytics", {
      requestId,
      userId: req.user?.id || 'anonymous'
    });
    
    const analytics = await Company.getAnalytics();
    
    logInfo("Company analytics fetched successfully", {
      requestId,
      userId: req.user?.id || 'anonymous'
    });

    return sendResponse(
      res,
      200,
      true,
      "Company analytics fetched successfully",
      analytics,
      requestId
    );
  } catch (error) {
    logError("Fetching company analytics failed", error, {
      requestId,
      userId: req.user?.id || 'anonymous'
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during analytics fetch",
      null,
      requestId
    );
  }
};

// GET - Company activity log
export const getCompanyActivity = async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logInfo("Fetching company activity log", {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.id
    });
    
    const company = await Company.findById(req.params.id)
      .select("activityLog")
      .populate("activityLog.user", "name email role");
    
    if (!company) {
      logWarn("Fetching company activity failed - company not found", {
        requestId,
        userId: req.user?.id || 'anonymous',
        companyId: req.params.id
      });
      
      return sendResponse(
        res,
        404,
        false,
        "Company not found",
        null,
        requestId
      );
    }
    
    // Pagination for activity log
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Sort activities by timestamp (newest first)
    const activities = company.activityLog
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(skip, skip + limit);
    
    const total = company.activityLog.length;
    
    const response = {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    logInfo("Company activity log fetched successfully", {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.id,
      count: activities.length
    });

    return sendResponse(
      res,
      200,
      true,
      "Company activity log fetched successfully",
      response,
      requestId
    );
  } catch (error) {
    logError("Fetching company activity log failed", error, {
      requestId,
      userId: req.user?.id || 'anonymous',
      companyId: req.params.id
    });
    
    return sendResponse(
      res,
      500,
      false,
      "Server error during activity log fetch",
      null,
      requestId
    );
  }
};