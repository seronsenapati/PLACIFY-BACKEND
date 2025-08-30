import streamifier from "streamifier";
import cloudinary from "../utils/cloudinary.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import sendResponse from "../utils/sendResponse.js";

function isProfileComplete(user) {
  return (
    user.name &&
    user.about &&
    user.about.gender &&
    user.about.location &&
    user.about.primaryRole &&
    user.about.experience !== undefined && // Check if experience exists
    user.skills.length > 0 &&
    user.education.length > 0 &&
    user.profilePhoto &&
    user.resume
  );
}

// GET Profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password -__v");
    if (!user) return sendResponse(res, 404, false, "User not found");

    if (user.role === "recruiter") {
      const company = await Company.findById(user.company).select(
        "name location desc website logo createdAt updatedAt"
      );
      return sendResponse(res, 200, true, "Profile fetched", {
        ...user.toObject(),
        company: company || null,
      });
    }

    return sendResponse(res, 200, true, "Profile fetched", user);
  } catch (err) {
    console.error("Get Profile Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    return sendResponse(res, 500, false, "Server error");
  }
};

// UPDATE Profile
export const updateProfile = async (req, res) => {
  try {
    let updateData = { ...req.body };

    // Handle profile photo upload
    if (req.file && req.file.fieldname === "profilePhoto") {
      try {
        const streamUpload = () =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "placify_profilePhotos", resource_type: "image" },
              (error, result) => (result ? resolve(result) : reject(error))
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
          });

        const result = await streamUpload();
        updateData.profilePhoto = result.secure_url;
      } catch (uploadError) {
        console.error("Profile photo upload error:", uploadError);
        return sendResponse(res, 400, false, "Error uploading profile photo");
      }
    }

    // Handle resume upload
    if (req.file && req.file.fieldname === "resume") {
      try {
        const streamUpload = () =>
          new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: "placify_resumes",
                resource_type: "raw",
                format: "pdf",
              },
              (error, result) => (result ? resolve(result) : reject(error))
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
          });

        const result = await streamUpload();
        updateData.resume = result.secure_url;
      } catch (uploadError) {
        console.error("Resume upload error:", uploadError);
        return sendResponse(res, 400, false, "Error uploading resume");
      }
    }

    // Parse JSON fields if sent as strings
    const parseField = (field) => {
      if (updateData[field] && typeof updateData[field] === "string") {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (e) {
          console.error(`Error parsing ${field}:`, e);
          return false;
        }
      }
      return true;
    };

    // Parse all JSON fields
    const fieldsToParse = [
      "skills",
      "education",
      "socialProfiles",
      "about",
      "openToRoles",
    ];
    for (const field of fieldsToParse) {
      if (!parseField(field)) {
        return sendResponse(res, 400, false, `Invalid ${field} format`);
      }
    }

    // Handle experience data - move yearsOfExperience to about.experience
    if (updateData.yearsOfExperience !== undefined) {
      if (!updateData.about) {
        updateData.about = {};
      }
      updateData.about.experience = parseInt(updateData.yearsOfExperience) || 0;
      delete updateData.yearsOfExperience;
    }

    // Remove any legacy experience array if it exists
    if (updateData.experience) {
      delete updateData.experience;
    }

    // Validate required fields
    if (updateData.about) {
      const requiredFields = [
        "gender",
        "location",
        "primaryRole",
        "experience",
      ];
      const missingFields = requiredFields.filter(
        (field) =>
          updateData.about[field] === undefined ||
          updateData.about[field] === "" ||
          updateData.about[field] === null
      );

      if (missingFields.length > 0) {
        return sendResponse(
          res,
          400,
          false,
          `Missing required fields in about: ${missingFields.join(", ")}`
        );
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -__v");

    if (!updatedUser) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Update profile completion status
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    return sendResponse(res, 200, true, "Profile updated", updatedUser);
  } catch (err) {
    console.error("Update Profile Error:", {
      message: err.message,
      stack: err.stack,
      body: req.body,
      file: req.file
        ? {
            fieldname: req.file.fieldname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : null,
    });
    return sendResponse(res, 500, false, "Server error");
  }
};
