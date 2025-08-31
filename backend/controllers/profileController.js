import streamifier from "streamifier";
import cloudinary from "../utils/cloudinary.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import sendResponse from "../utils/sendResponse.js";

function isProfileComplete(user) {
  try {
    console.log("Profile completion validation for user:", {
      userId: user._id,
      name: user.name,
      about: user.about,
      education: user.education?.length || 0,
      skills: user.skills?.length || 0,
      openToRoles: user.openToRoles?.length || 0,
      profilePhoto: !!user.profilePhoto,
      resume: !!user.resume,
      socialProfiles: user.socialProfiles,
    });

    // Enhanced validation for required fields
    const requiredFields = {
      name: user.name && user.name.trim().length > 0,
      about:
        user.about &&
        user.about.gender &&
        user.about.gender.trim().length > 0 &&
        user.about.location &&
        user.about.location.trim().length > 0 &&
        user.about.primaryRole &&
        user.about.primaryRole.trim().length > 0 &&
        typeof user.about.experience === "number" &&
        user.about.experience >= 0,
      skills:
        user.skills && Array.isArray(user.skills) && user.skills.length > 0,
      education:
        user.education &&
        Array.isArray(user.education) &&
        user.education.length > 0,
      openToRoles:
        user.openToRoles &&
        Array.isArray(user.openToRoles) &&
        user.openToRoles.length > 0,
      profilePhoto: user.profilePhoto && user.profilePhoto.trim().length > 0,
      resume: user.resume && user.resume.trim().length > 0,
    };

    // Check for social links - must have at least one non-empty social link
    const socialLinks = user.socialProfiles || {};
    const hasAtLeastOneSocialLink = Object.values(socialLinks).some(
      (link) => link && typeof link === "string" && link.trim().length > 0
    );
    requiredFields.socialProfiles = hasAtLeastOneSocialLink;

    // Log validation details for debugging
    console.log("Profile completion validation results:", {
      userId: user._id,
      requiredFields,
      allFieldsComplete: Object.values(requiredFields).every(Boolean),
      missingFields: Object.keys(requiredFields).filter(
        (key) => !requiredFields[key]
      ),
    });

    return Object.values(requiredFields).every(Boolean);
  } catch (error) {
    console.error("Error in isProfileComplete:", error);
    return false;
  }
}

// Validate education data - Use 'school' field as per memory requirements
function validateEducation(education) {
  if (!Array.isArray(education)) {
    console.log("Education validation: Not an array, returning empty array");
    return [];
  }

  console.log("Validating education data:", education);

  const validated = education
    .filter((edu) => {
      const isValid = edu && typeof edu === "object";
      if (!isValid) console.log("Filtering out invalid education entry:", edu);
      return isValid;
    })
    .map((edu) => {
      const cleaned = {
        degree: typeof edu.degree === "string" ? edu.degree.trim() : "",
        // Use 'school' field consistently as per memory requirements
        school:
          typeof edu.school === "string"
            ? edu.school.trim()
            : typeof edu.institution === "string"
            ? edu.institution.trim()
            : "",
        fromYear: parseInt(edu.fromYear) || 0,
        toYear: edu.toYear ? parseInt(edu.toYear) : null,
      };

      // Validate parsed fromYear is not NaN as per memory requirements
      if (isNaN(cleaned.fromYear)) {
        cleaned.fromYear = 0;
      }

      // Validate parsed toYear is not NaN as per memory requirements
      if (cleaned.toYear && isNaN(cleaned.toYear)) {
        cleaned.toYear = null;
      }

      // Additional validation
      if (cleaned.toYear && cleaned.toYear < cleaned.fromYear) {
        console.log("Invalid toYear detected, resetting:", cleaned);
        cleaned.toYear = null; // Reset invalid toYear
      }

      return cleaned;
    })
    .filter((edu) => {
      const isValid =
        edu.degree &&
        edu.degree.length > 0 &&
        edu.school &&
        edu.school.length > 0 &&
        edu.fromYear &&
        edu.fromYear >= 1950 &&
        edu.fromYear <= new Date().getFullYear() + 5;
      if (!isValid) {
        console.log("Filtering out invalid education after cleaning:", edu);
      }
      return isValid;
    });

  console.log("Education validation complete:", {
    original: education.length,
    validated: validated.length,
    result: validated,
  });

  return validated;
}

// Validate and sanitize skills array
function validateSkills(skills) {
  if (!Array.isArray(skills)) return [];

  return skills
    .map((skill) => (typeof skill === "string" ? skill.trim() : ""))
    .filter((skill) => skill && skill.length > 0 && skill.length <= 50) // Limit skill length
    .slice(0, 50); // Limit number of skills
}

// Validate and sanitize openToRoles array - Always return array as per memory requirements
function validateOpenToRoles(openToRoles) {
  if (!Array.isArray(openToRoles)) {
    console.log("OpenToRoles validation: Not an array, returning empty array");
    return [];
  }

  console.log("Validating openToRoles data:", openToRoles);

  const validated = openToRoles
    .map((role) => {
      const cleaned = typeof role === "string" ? role.trim() : "";
      if (role !== cleaned) {
        console.log("Cleaned role:", { original: role, cleaned });
      }
      return cleaned;
    })
    .filter((role) => {
      const isValid = role && role.length > 0 && role.length <= 100;
      if (!isValid && role) {
        console.log("Filtering out invalid role:", role);
      }
      return isValid;
    })
    .slice(0, 20); // Limit number of roles

  console.log("OpenToRoles validation complete:", {
    original: openToRoles.length,
    validated: validated.length,
    result: validated,
  });

  return validated;
}

// Validate and sanitize social profiles
function validateSocialProfiles(socialProfiles) {
  if (!socialProfiles || typeof socialProfiles !== "object") return {};

  const allowedFields = ["linkedin", "github", "x", "instagram", "website"];
  const cleaned = {};

  allowedFields.forEach((field) => {
    if (socialProfiles[field] && typeof socialProfiles[field] === "string") {
      const cleanedValue = socialProfiles[field].trim();
      if (
        cleanedValue &&
        cleanedValue.length > 0 &&
        cleanedValue.length <= 500
      ) {
        cleaned[field] = cleanedValue;
      }
    }
  });

  return cleaned;
}

// Validate about object
function validateAbout(about) {
  if (!about || typeof about !== "object") {
    throw new Error("About information is required");
  }

  const required = ["gender", "location", "primaryRole"];
  const missing = required.filter(
    (field) =>
      !about[field] ||
      typeof about[field] !== "string" ||
      about[field].trim().length === 0
  );

  if (missing.length > 0) {
    throw new Error(`Missing required fields in about: ${missing.join(", ")}`);
  }

  const experience = parseInt(about.experience);
  if (isNaN(experience) || experience < 0 || experience > 70) {
    throw new Error("Experience must be a valid number between 0 and 70");
  }

  return {
    gender: about.gender.trim(),
    location: about.location.trim(),
    primaryRole: about.primaryRole.trim(),
    experience: experience,
  };
}

// GET Profile
export const getProfile = async (req, res) => {
  try {
    console.log("GET Profile request:", { userId: req.user._id });

    const user = await User.findById(req.user._id).select("-password -__v");
    if (!user) {
      console.log("User not found:", req.user._id);
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.role === "recruiter") {
      const company = await Company.findById(user.company).select(
        "name location desc website logo createdAt updatedAt"
      );

      console.log("Recruiter profile fetched:", {
        userId: user._id,
        hasCompany: !!company,
      });

      return sendResponse(res, 200, true, "Profile fetched", {
        ...user.toObject(),
        company: company || null,
      });
    }

    console.log("Student profile fetched:", {
      userId: user._id,
      profileCompleted: user.profileCompleted,
      hasEducation: user.education?.length || 0,
      hasSkills: user.skills?.length || 0,
      hasOpenToRoles: user.openToRoles?.length || 0,
    });

    return sendResponse(res, 200, true, "Profile fetched", user);
  } catch (err) {
    console.error("Get Profile Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    return sendResponse(res, 500, false, "Server error", null, {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// UPDATE Profile (for non-file data only, files handled by separate endpoints)
export const updateProfile = async (req, res) => {
  let updateData = null;

  try {
    updateData = { ...req.body };

    console.log("Update Profile Request:", {
      userId: req.user._id,
      bodyKeys: Object.keys(req.body),
      hasFile: !!req.file,
      fileType: req.file?.fieldname,
      bodySize: JSON.stringify(req.body).length,
      isFileUpload: req.headers["content-type"]?.includes(
        "multipart/form-data"
      ),
    });

    // Handle file uploads (for legacy support or when files come through main endpoint)
    if (req.file) {
      try {
        console.log("Processing file upload:", {
          fieldname: req.file.fieldname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          originalname: req.file.originalname,
        });

        const streamUpload = (folder, resourceType = "image") =>
          new Promise((resolve, reject) => {
            const uploadOptions = {
              folder: folder,
              resource_type: resourceType,
            };

            if (resourceType === "raw") {
              uploadOptions.format = "pdf";
            }

            const stream = cloudinary.uploader.upload_stream(
              uploadOptions,
              (error, result) => (result ? resolve(result) : reject(error))
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
          });

        let result;
        if (req.file.fieldname === "profilePhoto") {
          result = await streamUpload("placify_profilePhotos", "image");
          updateData.profilePhoto = result.secure_url;
          console.log("Profile photo uploaded:", result.secure_url);
        } else if (req.file.fieldname === "resume") {
          result = await streamUpload("placify_resumes", "raw");
          updateData.resume = result.secure_url;
          console.log("Resume uploaded:", result.secure_url);
        }
      } catch (uploadError) {
        console.error("File upload error:", {
          error: uploadError.message,
          stack: uploadError.stack,
        });
        return sendResponse(
          res,
          400,
          false,
          `Error uploading ${req.file.fieldname}: ${uploadError.message}`
        );
      }
    }

    // Parse JSON fields if sent as strings
    const jsonFields = [
      "skills",
      "education",
      "socialProfiles",
      "about",
      "openToRoles",
    ];

    for (const field of jsonFields) {
      if (updateData[field] && typeof updateData[field] === "string") {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (parseError) {
          console.error(`Error parsing ${field}:`, parseError.message);
          return sendResponse(
            res,
            400,
            false,
            `Invalid ${field} format: ${parseError.message}`
          );
        }
      }
    }

    // Handle legacy experience field migration
    if (updateData.yearsOfExperience !== undefined) {
      if (!updateData.about) updateData.about = {};
      updateData.about.experience = parseInt(updateData.yearsOfExperience) || 0;
      delete updateData.yearsOfExperience;
    }

    // Remove legacy experience array
    if (updateData.experience) {
      delete updateData.experience;
    }

    // Validate and clean data according to memory requirements
    if (updateData.about) {
      updateData.about = validateAbout(updateData.about);
    }

    if (updateData.education !== undefined) {
      updateData.education = validateEducation(updateData.education);
      console.log("Education validation result:", {
        original: req.body.education,
        cleaned: updateData.education,
        count: updateData.education.length,
      });
    }

    if (updateData.skills !== undefined) {
      updateData.skills = validateSkills(updateData.skills);
      console.log("Skills validation result:", {
        original: req.body.skills,
        cleaned: updateData.skills,
        count: updateData.skills.length,
      });
    }

    if (updateData.openToRoles !== undefined) {
      updateData.openToRoles = validateOpenToRoles(updateData.openToRoles);
      console.log("OpenToRoles validation result:", {
        original: req.body.openToRoles,
        cleaned: updateData.openToRoles,
        count: updateData.openToRoles.length,
      });
    }

    if (updateData.socialProfiles !== undefined) {
      updateData.socialProfiles = validateSocialProfiles(
        updateData.socialProfiles
      );
      console.log("Social profiles validation result:", {
        original: req.body.socialProfiles,
        cleaned: updateData.socialProfiles,
        keys: Object.keys(updateData.socialProfiles),
      });
    }

    // Additional validation for name
    if (updateData.name !== undefined) {
      if (
        typeof updateData.name !== "string" ||
        updateData.name.trim().length === 0
      ) {
        return sendResponse(
          res,
          400,
          false,
          "Name is required and must be a non-empty string"
        );
      }
      updateData.name = updateData.name.trim();
      if (updateData.name.length > 100) {
        return sendResponse(
          res,
          400,
          false,
          "Name must be less than 100 characters"
        );
      }
    }

    // Clean data payload by removing empty values as per memory requirements
    // But always keep openToRoles even if empty as per memory specification
    const originalUpdateData = { ...updateData };
    Object.keys(updateData).forEach((key) => {
      if (key === "openToRoles") {
        // Always send openToRoles, even if empty array (memory requirement)
        return;
      }

      const value = updateData[key];
      if (
        value === "" ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" &&
          value !== null &&
          Object.keys(value).length === 0)
      ) {
        console.log(`Removing empty field '${key}':`, value);
        delete updateData[key];
      }
    });

    console.log("Data cleaning summary:", {
      originalFields: Object.keys(originalUpdateData),
      cleanedFields: Object.keys(updateData),
      removedFields: Object.keys(originalUpdateData).filter(
        (key) => !Object.keys(updateData).includes(key)
      ),
    });

    console.log("Cleaned update data:", {
      hasName: !!updateData.name,
      hasAbout: !!updateData.about,
      educationCount: updateData.education?.length || 0,
      skillsCount: updateData.skills?.length || 0,
      openToRolesCount: updateData.openToRoles?.length || 0,
      socialProfilesKeys: updateData.socialProfiles
        ? Object.keys(updateData.socialProfiles)
        : [],
      hasProfilePhoto: !!updateData.profilePhoto,
      hasResume: !!updateData.resume,
      finalPayload: updateData,
    });

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
        select: "-password -__v",
      }
    );

    if (!updatedUser) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Update profile completion status
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
      console.log("Profile completion status updated:", {
        userId: updatedUser._id,
        newStatus: profileCompleted,
      });
    }

    console.log("Profile updated successfully:", {
      userId: updatedUser._id,
      profileCompleted: updatedUser.profileCompleted,
      fieldsUpdated: Object.keys(updateData),
    });

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      updatedUser
    );
  } catch (err) {
    console.error("Update Profile Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
      updateData: updateData
        ? {
            hasName: !!updateData.name,
            hasAbout: !!updateData.about,
            hasEducation: !!updateData.education,
            hasSkills: !!updateData.skills,
            hasOpenToRoles: !!updateData.openToRoles,
            hasSocialProfiles: !!updateData.socialProfiles,
          }
        : null,
      validationError: err.name === "ValidationError" ? err.message : undefined,
    });

    // Handle specific error types
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return sendResponse(
        res,
        400,
        false,
        `Validation failed: ${errors.join(", ")}`
      );
    }

    if (err.name === "CastError") {
      return sendResponse(res, 400, false, "Invalid data format provided");
    }

    return sendResponse(res, 500, false, "Server error", null, {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
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

    if (!user.resume) {
      return sendResponse(res, 400, false, "No resume found to delete");
    }

    const oldResumeUrl = user.resume;
    console.log("Deleting resume:", oldResumeUrl);

    // Extract public_id from Cloudinary URL for deletion
    if (oldResumeUrl && oldResumeUrl.includes("cloudinary.com")) {
      try {
        // More robust public_id extraction
        const urlParts = oldResumeUrl.split("/");
        const versionIndex = urlParts.findIndex((part) => part.startsWith("v"));

        let publicIdParts;
        if (versionIndex > 0) {
          // URL has version, get parts after version
          publicIdParts = urlParts.slice(versionIndex + 1);
        } else {
          // No version, get last parts
          publicIdParts = urlParts.slice(-2);
        }

        const filename = publicIdParts[publicIdParts.length - 1];
        const folder =
          publicIdParts.length > 1 ? publicIdParts[0] : "placify_resumes";
        const publicId = `${folder}/${filename.split(".")[0]}`;

        console.log("Attempting to delete from Cloudinary:", {
          originalUrl: oldResumeUrl,
          extractedPublicId: publicId,
        });

        const cloudinaryResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: "raw",
        });

        console.log("Cloudinary deletion result:", cloudinaryResult);
      } catch (cloudinaryError) {
        console.error("Error deleting from Cloudinary:", {
          error: cloudinaryError.message,
          stack: cloudinaryError.stack,
          resumeUrl: oldResumeUrl,
        });
        // Continue with database update even if Cloudinary deletion fails
      }
    }

    // Remove resume from user profile
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $unset: { resume: 1 } },
      { new: true, runValidators: true, select: "-password -__v" }
    );

    // Update profile completion status
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
    return sendResponse(res, 500, false, "Server error", null, {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};
