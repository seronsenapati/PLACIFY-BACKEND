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
      profilePhoto: !!user.profilePhoto,
      resume: !!user.resume,
      socialProfiles: user.socialProfiles,
    });

    // Enhanced validation for required fields (10 fields total - NO openToRoles)
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

// Clean education data to ensure proper formatting
function cleanEducationData(education) {
  if (!Array.isArray(education)) {
    return [];
  }

  return education.map(edu => {
    if (!edu || typeof edu !== "object") {
      return edu;
    }

    // Create a copy of the education object
    const cleanedEdu = { ...edu };

    // Clean up fromYear
    if (cleanedEdu.fromYear !== undefined) {
      if (typeof cleanedEdu.fromYear === "string") {
        const parsed = parseInt(cleanedEdu.fromYear, 10);
        cleanedEdu.fromYear = isNaN(parsed) ? undefined : parsed;
      }
    }

    // Clean up toYear
    if (cleanedEdu.toYear !== undefined) {
      if (typeof cleanedEdu.toYear === "string") {
        if (cleanedEdu.toYear.trim() === "") {
          cleanedEdu.toYear = undefined;
        } else {
          const parsed = parseInt(cleanedEdu.toYear, 10);
          cleanedEdu.toYear = isNaN(parsed) ? undefined : parsed;
        }
      }
      
      // Handle null or "null" values
      if (cleanedEdu.toYear === null || cleanedEdu.toYear === "null") {
        cleanedEdu.toYear = undefined;
      }
    }

    return cleanedEdu;
  });
}

// Validate education data - Use 'school' field as per memory requirements
function validateEducation(education) {
  if (!Array.isArray(education)) {
    console.log("Education validation: Not an array, returning empty array");
    return [];
  }

  return education
    .filter((edu) => edu && typeof edu === "object")
    .map((edu) => {
      // Log the education entry for debugging
      console.log("Processing education entry:", edu);
      
      // Validate required fields
      if (!edu.school || typeof edu.school !== "string") {
        console.log("Education validation: Invalid school field");
        throw new Error("School field is required and must be a string");
      }

      if (!edu.degree || typeof edu.degree !== "string") {
        console.log("Education validation: Invalid degree field");
        throw new Error("Degree field is required and must be a string");
      }

      // Handle fromYear conversion if it's a string
      let fromYear = edu.fromYear;
      if (typeof fromYear === "string") {
        fromYear = parseInt(fromYear, 10);
      }

      // Handle case where fromYear might be missing or invalid for existing entries
      if (fromYear === undefined || fromYear === null || fromYear === "") {
        console.log("Education validation: fromYear is missing or invalid", {
          originalFromYear: edu.fromYear,
          processedFromYear: fromYear
        });
        throw new Error("From year is required and must be a valid year");
      }

      if (
        typeof fromYear !== "number" ||
        isNaN(fromYear) ||
        fromYear < 1900 ||
        fromYear > new Date().getFullYear() + 5
      ) {
        console.log("Education validation: Invalid fromYear field", {
          fromYear: edu.fromYear,
          parsedFromYear: fromYear,
          type: typeof fromYear,
          currentYear: new Date().getFullYear(),
          maxYear: new Date().getFullYear() + 5
        });
        throw new Error(
          "From year is required and must be a valid year between 1900 and " +
            (new Date().getFullYear() + 5)
        );
      }

      // Handle toYear conversion if it's a string
      let toYear = edu.toYear;
      if (typeof toYear === "string") {
        // Handle empty string case
        if (toYear.trim() === "") {
          toYear = undefined;
        } else {
          toYear = parseInt(toYear, 10);
        }
      }

      // If toYear is null, empty string, or "null" string, treat it as undefined
      if (toYear === null || toYear === "" || (typeof toYear === "string" && toYear.toLowerCase() === "null")) {
        toYear = undefined;
      }

      // Special handling for existing entries that might have invalid toYear values
      // If toYear is provided but invalid, we'll set it to undefined to avoid validation errors
      if (
        toYear !== undefined &&
        (typeof toYear !== "number" ||
          isNaN(toYear) ||
          toYear < fromYear ||
          toYear > new Date().getFullYear() + 5)
      ) {
        console.log("Education validation: Invalid toYear field, setting to undefined", {
          originalToYear: edu.toYear,
          parsedToYear: toYear,
          fromYear: fromYear,
          type: typeof toYear,
          currentYear: new Date().getFullYear(),
          maxYear: new Date().getFullYear() + 5
        });
        // Instead of throwing an error, we'll set toYear to undefined for existing entries
        // This is more user-friendly for existing data that might have been entered incorrectly
        toYear = undefined;
      }

      return {
        school: edu.school.trim(),
        degree: edu.degree.trim(),
        fromYear: fromYear,
        toYear: toYear, // Will be undefined if not provided
      };
    });
}

function validateAbout(about) {
  if (!about || typeof about !== "object") {
    console.log("About validation: Not an object, returning null");
    return null;
  }

  // Validate required fields
  if (!about.gender || typeof about.gender !== "string") {
    console.log("About validation: Invalid gender field");
    throw new Error("Gender field is required and must be a string");
  }

  if (!about.location || typeof about.location !== "string") {
    console.log("About validation: Invalid location field");
    throw new Error("Location field is required and must be a string");
  }

  if (!about.primaryRole || typeof about.primaryRole !== "string") {
    console.log("About validation: Invalid primaryRole field");
    throw new Error("Primary role field is required and must be a string");
  }

  // Validate experience
  const experience = parseInt(about.experience);
  if (isNaN(experience) || experience < 0 || experience > 70) {
    console.log("About validation: Invalid experience field");
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
      // If user doesn't have company field but is a recruiter, try to find their company
      if (!user.company) {
        console.log("Recruiter missing company field, searching for associated company");
        const company = await Company.findOne({ createdBy: user._id }).select(
          "name location desc website logo createdAt updatedAt"
        );
        
        if (company) {
          console.log("Found company for recruiter, updating user profile");
          // Update user with company reference
          user.company = company._id;
          await user.save();
        }
      }
      
      // Now fetch the company details
      const company = await Company.findById(user.company).select(
        "name location desc website logo createdAt updatedAt"
      );

      console.log("Recruiter profile fetched:", {
        userId: user._id,
        hasCompany: !!company,
        companyId: user.company
      });

      return sendResponse(res, 200, true, "Profile fetched", {
        ...user.toObject(),
        company: company || null,
        recruiterSettings: user.recruiterSettings || {}
      });
    }

    console.log("Student profile fetched:", {
      userId: user._id,
      profileCompleted: user.profileCompleted,
      hasEducation: user.education?.length || 0,
      hasSkills: user.skills?.length || 0,
    });

    return sendResponse(res, 200, true, "Profile fetched", user);
  } catch (err) {
    console.error("🔴 [Get Profile Error]:", err);
    return sendResponse(res, 500, false, "Server error");
  }
};

// UPDATE Profile
export const updateProfile = async (req, res) => {
  try {
    console.log("UPDATE Profile request:", {
      userId: req.user._id,
      body: req.body,
      file: !!req.file,
    });

    // Log education data specifically if it exists
    if (req.body.education) {
      console.log("Education data received:", req.body.education);
      try {
        const parsedEducation = JSON.parse(req.body.education);
        console.log("Parsed education data:", parsedEducation);
      } catch (e) {
        console.log("Education data is not JSON string:", req.body.education);
      }
    }

    const userId = req.user._id;
    const updates = req.body;

    // Fetch user with all fields
    let user = await User.findById(userId);
    if (!user) {
      console.log("User not found:", userId);
      return sendResponse(res, 404, false, "User not found");
    }

    // Handle profile photo upload
    if (req.file) {
      try {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_profiles",
              transformation: [
                { width: 500, height: 500, crop: "limit" },
                { quality: "auto" },
              ],
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
        });

        user.profilePhoto = result.secure_url;
        console.log("Profile photo uploaded:", result.secure_url);
      } catch (uploadError) {
        console.error("Profile photo upload error:", uploadError);
        return sendResponse(res, 500, false, "Error uploading profile photo");
      }
    }

    // Update fields if provided
    if (updates.name !== undefined) {
      if (typeof updates.name !== "string" || updates.name.trim().length === 0) {
        return sendResponse(res, 400, false, "Name must be a non-empty string");
      }
      user.name = updates.name.trim();
    }

    if (updates.username !== undefined) {
      if (
        typeof updates.username !== "string" ||
        updates.username.trim().length === 0
      ) {
        return sendResponse(
          res,
          400,
          false,
          "Username must be a non-empty string"
        );
      }
      // Check if username is already taken by another user
      const existingUser = await User.findOne({
        username: updates.username.trim(),
        _id: { $ne: userId },
      });
      if (existingUser) {
        return sendResponse(res, 400, false, "Username is already taken");
      }
      user.username = updates.username.trim();
    }

    if (updates.email !== undefined) {
      if (
        typeof updates.email !== "string" ||
        updates.email.trim().length === 0
      ) {
        return sendResponse(
          res,
          400,
          false,
          "Email must be a non-empty string"
        );
      }
      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: updates.email.trim(),
        _id: { $ne: userId },
      });
      if (existingUser) {
        return sendResponse(res, 400, false, "Email is already taken");
      }
      user.email = updates.email.trim();
    }

    // Student-specific updates
    if (user.role === "student") {
      if (updates.about !== undefined) {
        try {
          const validatedAbout = validateAbout(updates.about);
          user.about = validatedAbout;
        } catch (error) {
          console.log("About validation error:", error.message);
          return sendResponse(res, 400, false, error.message);
        }
      }

      if (updates.education !== undefined) {
        try {
          let educationData = updates.education;
          
          // Log the raw education data for debugging
          console.log("Raw education data received:", educationData);
          
          // If education is a string, try to parse it as JSON
          if (typeof educationData === "string") {
            try {
              educationData = JSON.parse(educationData);
            } catch (parseError) {
              console.log("Education data parsing error:", parseError);
              return sendResponse(res, 400, false, "Invalid education data format: " + parseError.message);
            }
          }
          
          // Ensure educationData is an array
          if (!Array.isArray(educationData)) {
            console.log("Education data is not an array:", educationData);
            return sendResponse(res, 400, false, "Education data must be an array");
          }
          
          // Clean the education data before validation
          const cleanedEducationData = cleanEducationData(educationData);
          console.log("Cleaned education data:", cleanedEducationData);
          
          const validatedEducation = validateEducation(cleanedEducationData);
          user.education = validatedEducation;
        } catch (error) {
          console.log("Education validation error:", error.message);
          // Provide more specific error information
          return sendResponse(res, 400, false, "Education validation failed: " + error.message);
        }
      }

      if (updates.skills !== undefined) {
        if (!Array.isArray(updates.skills)) {
          return sendResponse(res, 400, false, "Skills must be an array");
        }
        // Validate each skill
        const validatedSkills = updates.skills
          .filter((skill) => typeof skill === "string" && skill.trim().length > 0)
          .map((skill) => skill.trim())
          .slice(0, 50); // Limit to 50 skills

        user.skills = validatedSkills;
      }

      if (updates.socialProfiles !== undefined) {
        if (
          updates.socialProfiles === null ||
          typeof updates.socialProfiles === "object"
        ) {
          user.socialProfiles = updates.socialProfiles;
        } else {
          return sendResponse(
            res,
            400,
            false,
            "Social profiles must be an object or null"
          );
        }
      }

      // Update profile completion status
      user.profileCompleted = isProfileComplete(user);
    }

    // Save updated user
    await user.save();

    // Return updated user data (exclude sensitive fields)
    const updatedUser = await User.findById(userId).select("-password -__v");

    console.log("Profile updated successfully:", {
      userId: updatedUser._id,
      role: updatedUser.role,
    });

    return sendResponse(res, 200, true, "Profile updated successfully", updatedUser);
  } catch (err) {
    console.error("🔴 [Update Profile Error]:", err);
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
