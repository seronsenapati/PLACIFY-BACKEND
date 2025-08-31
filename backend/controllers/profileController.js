import streamifier from "streamifier";
import cloudinary from "../utils/cloudinary.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import sendResponse from "../utils/sendResponse.js";

function isProfileComplete(user) {
  // Check for social links - must have at least one non-empty social link
  const socialLinks = user.socialProfiles || {};
  const hasAtLeastOneSocialLink = Object.values(socialLinks).some(
    (link) => link && link.trim() && link.trim().length > 0
  );

  return (
    user.name &&
    user.about &&
    user.about.gender &&
    user.about.location &&
    user.about.primaryRole &&
    user.about.experience !== undefined && // Check if experience exists
    user.skills &&
    user.skills.length > 0 &&
    user.education &&
    user.education.length > 0 &&
    user.openToRoles &&
    user.openToRoles.length > 0 && // FIXED: Added openToRoles check
    user.profilePhoto &&
    user.resume &&
    hasAtLeastOneSocialLink // FIXED: Added social links check
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

    console.log("Update Profile Request:", {
      userId: req.user._id,
      body: req.body,
      file: req.file
        ? {
            fieldname: req.file.fieldname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            originalname: req.file.originalname,
          }
        : null,
    });

    // Handle profile photo upload
    if (req.file && req.file.fieldname === "profilePhoto") {
      try {
        console.log("Uploading profile photo to Cloudinary...");
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
        console.log("Profile photo uploaded successfully:", result.secure_url);
      } catch (uploadError) {
        console.error("Profile photo upload error:", {
          error: uploadError,
          message: uploadError.message,
          stack: uploadError.stack,
        });
        return sendResponse(res, 400, false, "Error uploading profile photo");
      }
    }

    // Handle resume upload
    if (req.file && req.file.fieldname === "resume") {
      try {
        console.log("Uploading resume to Cloudinary...");
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
        console.log("Resume uploaded successfully:", result.secure_url);
      } catch (uploadError) {
        console.error("Resume upload error:", {
          error: uploadError,
          message: uploadError.message,
          stack: uploadError.stack,
        });
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

    // Parse all JSON fields - FIXED: Ensure openToRoles is properly parsed
    const fieldsToParse = [
      "skills",
      "education",
      "socialProfiles",
      "about",
      "openToRoles", // FIXED: Ensure this is included in parsing
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

    // FIXED: Validate and clean openToRoles data
    if (updateData.openToRoles) {
      if (Array.isArray(updateData.openToRoles)) {
        // Clean and filter openToRoles
        updateData.openToRoles = updateData.openToRoles
          .map((role) => (typeof role === "string" ? role.trim() : ""))
          .filter((role) => role && role.length > 0);
      } else {
        // If it's not an array, set it to empty array
        updateData.openToRoles = [];
      }
    } else {
      // Ensure openToRoles exists as an array
      updateData.openToRoles = [];
    }

    // FIXED: Validate and clean skills data
    if (updateData.skills) {
      if (Array.isArray(updateData.skills)) {
        updateData.skills = updateData.skills
          .map((skill) => (typeof skill === "string" ? skill.trim() : ""))
          .filter((skill) => skill && skill.length > 0);
      } else {
        updateData.skills = [];
      }
    }

    // FIXED: Validate and clean education data
    if (updateData.education) {
      if (Array.isArray(updateData.education)) {
        updateData.education = updateData.education
          .filter((edu) => edu && typeof edu === "object")
          .map((edu) => ({
            degree: edu.degree ? edu.degree.trim() : "",
            school: edu.school ? edu.school.trim() : "", // Backend uses 'school' field
            fromYear: parseInt(edu.fromYear) || 0,
            toYear: edu.toYear ? parseInt(edu.toYear) : null,
          }))
          .filter((edu) => edu.degree && edu.school && edu.fromYear);
      } else {
        updateData.education = [];
      }
    }

    // FIXED: Validate and clean socialProfiles data
    if (
      updateData.socialProfiles &&
      typeof updateData.socialProfiles === "object"
    ) {
      const cleanedSocialProfiles = {};
      const allowedFields = ["linkedin", "github", "x", "instagram", "website"];

      allowedFields.forEach((field) => {
        if (
          updateData.socialProfiles[field] &&
          typeof updateData.socialProfiles[field] === "string"
        ) {
          const cleanedValue = updateData.socialProfiles[field].trim();
          if (cleanedValue) {
            cleanedSocialProfiles[field] = cleanedValue;
          }
        }
      });

      updateData.socialProfiles = cleanedSocialProfiles;
    }

    // Validate required fields in about object
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

      // FIXED: Validate experience is a valid number
      if (updateData.about.experience !== undefined) {
        const expValue = parseInt(updateData.about.experience);
        if (isNaN(expValue) || expValue < 0) {
          return sendResponse(
            res,
            400,
            false,
            "Experience must be a valid number (0 or greater)"
          );
        }
        updateData.about.experience = expValue;
      }
    }

    console.log("Cleaned update data being sent to database:", {
      ...updateData,
      openToRolesLength: updateData.openToRoles
        ? updateData.openToRoles.length
        : 0,
      skillsLength: updateData.skills ? updateData.skills.length : 0,
      educationLength: updateData.education ? updateData.education.length : 0,
      socialProfilesKeys: updateData.socialProfiles
        ? Object.keys(updateData.socialProfiles)
        : [],
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -__v");

    if (!updatedUser) {
      return sendResponse(res, 404, false, "User not found");
    }

    // FIXED: Update profile completion status with correct validation
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    console.log("Profile updated successfully:", {
      userId: updatedUser._id,
      profileCompleted: updatedUser.profileCompleted,
      openToRolesCount: updatedUser.openToRoles
        ? updatedUser.openToRoles.length
        : 0,
      skillsCount: updatedUser.skills ? updatedUser.skills.length : 0,
      educationCount: updatedUser.education ? updatedUser.education.length : 0,
      socialProfilesCount: updatedUser.socialProfiles
        ? Object.keys(updatedUser.socialProfiles).length
        : 0,
    });

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

// DELETE Resume
export const deleteResume = async (req, res) => {
  try {
    console.log("Delete resume request:", {
      userId: req.user._id,
      timestamp: new Date().toISOString(),
    });

    const user = await User.findById(req.user._id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Check if user has a resume
    if (!user.resume) {
      return sendResponse(res, 400, false, "No resume found to delete");
    }

    const oldResumeUrl = user.resume;
    console.log("Deleting resume:", oldResumeUrl);

    // Extract public_id from Cloudinary URL for deletion
    if (oldResumeUrl && oldResumeUrl.includes("cloudinary.com")) {
      try {
        // Extract public_id from URL (format: .../placify_resumes/filename.pdf)
        const urlParts = oldResumeUrl.split("/");
        const filename = urlParts[urlParts.length - 1];
        const publicId = `placify_resumes/${filename.split(".")[0]}`;

        console.log(
          "Attempting to delete from Cloudinary with public_id:",
          publicId
        );

        // Delete from Cloudinary
        const cloudinaryResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: "raw",
        });

        console.log("Cloudinary deletion result:", cloudinaryResult);
      } catch (cloudinaryError) {
        console.error("Error deleting from Cloudinary:", {
          error: cloudinaryError,
          message: cloudinaryError.message,
          publicId: oldResumeUrl,
        });
        // Continue with database update even if Cloudinary deletion fails
      }
    }

    // Remove resume from user profile
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $unset: { resume: 1 } },
      { new: true, runValidators: true }
    ).select("-password -__v");

    // FIXED: Update profile completion status with correct validation
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    console.log("Resume deleted successfully:", {
      userId: updatedUser._id,
      profileCompleted: updatedUser.profileCompleted,
    });

    return sendResponse(
      res,
      200,
      true,
      "Resume deleted successfully",
      updatedUser
    );
  } catch (err) {
    console.error("Delete Resume Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    return sendResponse(res, 500, false, "Server error");
  }
};
