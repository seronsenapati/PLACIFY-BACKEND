import Company from "../models/Company.js";
import sendResponse from "../utils/sendResponse.js";
import validateFields from "../utils/validateFields.js";
import { validateCompanyFields } from "../utils/validateAdvancedFields.js";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";

// POST - Create a new company
export const createCompany = async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return sendResponse(
        res,
        403,
        false,
        "Only recruiters can post companies"
      );
    }

    const { isValid, missingFields } = validateFields(
      ["name", "desc", "website"],
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

    const { name, desc, website } = req.body;

    const fieldErrors = validateCompanyFields({ website });
    if (fieldErrors.length > 0) {
      return sendResponse(res, 400, false, fieldErrors.join(", "));
    }

    let logoUrl = "";

    if (req.file) {
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_logos",
              resource_type: "image",
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req.file.buffer);
      logoUrl = result.secure_url;
    }

    const company = await Company.create({
      name,
      desc,
      website,
      logo: logoUrl,
      createdBy: req.user.id,
    });

    return sendResponse(
      res,
      201,
      true,
      "Company created successfully",
      company
    );
  } catch (error) {
    console.error("Company Create Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// GET - Fetch all companies with their jobs
export const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find()
      .populate("jobs", "title location salary")
      .sort({ createdAt: -1 });

    return sendResponse(
      res,
      200,
      true,
      "Companies fetched successfully",
      companies
    );
  } catch (error) {
    console.error("Company Fetch Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// GET - Company by ID
export const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).populate(
      "jobs",
      "title location salary"
    );

    if (!company) {
      return sendResponse(res, 404, false, "Company not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Company fetched successfully",
      company
    );
  } catch (error) {
    console.log("Company Fetch by ID Error:", error);

    if (error.name === "CastError") {
      return sendResponse(res, 400, false, "Invalid company ID");
    }

    return sendResponse(res, 500, false, "Server error");
  }
};

// PATCH - Update a company by ID
export const updateCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return sendResponse(res, 404, false, "Company not found");
    }

    // Only recruiter who created it or admin can update
    if (
      req.user.role !== "admin" &&
      company.createdBy.toString() !== req.user.id
    ) {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to update this company"
      );
    }

    const { name, desc, website } = req.body;

    if (website) {
      const fieldErrors = validateCompanyFields({ website });
      if (fieldErrors.length > 0) {
        return sendResponse(res, 400, false, fieldErrors.join(", "));
      }
    }

    // Upload logo if new file is provided
    if (req.file) {
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_logos",
              resource_type: "image",
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req.file.buffer);
      company.logo = result.secure_url;
    }

    // Only update provided fields
    if (name) company.name = name;
    if (desc) company.desc = desc;
    if (website) company.website = website;

    await company.save();

    return sendResponse(
      res,
      200,
      true,
      "Company updated successfully",
      company
    );
  } catch (error) {
    console.error("Company Update Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};
