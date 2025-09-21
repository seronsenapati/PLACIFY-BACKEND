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

// Helper function to format education date range
export function formatEducationDateRange(fromYear, toYear) {
  if (!fromYear) return '';
  
  if (toYear === undefined || toYear === null) {
    return `${fromYear} - Present`;
  }
  
  return `${fromYear} - ${toYear}`;
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
    // Handle the case where toYear might be null, undefined, or a string
    if (cleanedEdu.toYear !== undefined) {
      if (typeof cleanedEdu.toYear === "string") {
        if (cleanedEdu.toYear.trim() === "") {
          cleanedEdu.toYear = undefined;
        } else {
          const parsed = parseInt(cleanedEdu.toYear, 10);
          cleanedEdu.toYear = isNaN(parsed) ? undefined : parsed;
        }
      }
    }
    
    // Handle null or "null" values (need to check this separately from the undefined check)
    if (cleanedEdu.toYear === null || cleanedEdu.toYear === "null") {
      cleanedEdu.toYear = undefined;
    }
    
    // Add formatted date range for frontend display
    cleanedEdu.dateRange = formatEducationDateRange(cleanedEdu.fromYear, cleanedEdu.toYear);

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

      // Add formatted date range for frontend display
      const dateRange = formatEducationDateRange(fromYear, toYear);

      return {
        school: edu.school.trim(),
        degree: edu.degree.trim(),
        fromYear: fromYear,
        toYear: toYear, // Will be undefined if not provided (meaning "Present")
        dateRange: dateRange
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

    // Add formatted date ranges to education entries
    if (user.education && Array.isArray(user.education)) {
      user.education = user.education.map(edu => {
        if (edu && typeof edu === 'object') {
          return {
            ...edu,
            dateRange: formatEducationDateRange(edu.fromYear, edu.toYear)
          };
        }
        return edu;
      });
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
              console.log("Parsed education data from string:", educationData);
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
          
          // Log each education entry to see the exact data structure
          console.log("Education entries before cleaning:");
          educationData.forEach((entry, index) => {
            console.log(`Entry ${index}:`, entry);
          });
          
          // Clean the education data before validation
          const cleanedEducationData = cleanEducationData(educationData);
          console.log("Cleaned education data:", cleanedEducationData);
          
          // Log each cleaned education entry to see the exact data structure
          console.log("Education entries after cleaning:");
          cleanedEducationData.forEach((entry, index) => {
            console.log(`Entry ${index}:`, entry);
          });
          
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
    
    // Add formatted date ranges to education entries in the response
    if (updatedUser.education && Array.isArray(updatedUser.education)) {
      updatedUser.education = updatedUser.education.map(edu => {
        if (edu && typeof edu === 'object') {
          return {
            ...edu,
            dateRange: formatEducationDateRange(edu.fromYear, edu.toYear)
          };
        }
        return edu;
      });
    }

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

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return sendResponse(
        res,
        400,
        false,
        "Please select a profile photo to upload."
      );
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "placify_profile_photos",
          resource_type: "image",
          transformation: [
            { width: 500, height: 500, crop: "limit" },
            { quality: "auto" },
          ],
        },
        (error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    // Update user with new profile photo URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profilePhoto: result.secure_url },
      { new: true, runValidators: true }
    ).select("-password");

    // Check if profile is now complete
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    console.log("Profile photo uploaded successfully:", {
      userId: updatedUser._id,
      profilePhoto: result.secure_url,
      profileCompleted: updatedUser.profileCompleted,
    });

    return sendResponse(
      res,
      200,
      true,
      "Profile photo uploaded successfully",
      updatedUser
    );
  } catch (err) {
    console.error("Upload Profile Photo Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    
    // Handle Cloudinary upload errors
    if (err.message && err.message.includes('Invalid image file')) {
      return sendResponse(
        res,
        400,
        false,
        "Please upload a valid image file (JPEG, PNG, GIF)."
      );
    }
    
    // Handle file size errors
    if (err.message && err.message.includes('File size')) {
      return sendResponse(
        res,
        400,
        false,
        "Profile photo is too large. Please upload an image smaller than 5MB."
      );
    }
    
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while uploading your profile photo. Please try again later."
    );
  }
};

export const deleteProfilePhoto = async (req, res) => {
  try {
    // Remove profile photo URL from user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profilePhoto: "" },
      { new: true, runValidators: true }
    ).select("-password");

    // Check if profile is still complete
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    console.log("Profile photo deleted successfully:", {
      userId: updatedUser._id,
      profileCompleted: updatedUser.profileCompleted,
    });

    return sendResponse(
      res,
      200,
      true,
      "Profile photo deleted successfully",
      updatedUser
    );
  } catch (err) {
    console.error("Delete Profile Photo Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while deleting your profile photo. Please try again later."
    );
  }
};

export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return sendResponse(res, 400, false, "Please select a resume to upload.");
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return sendResponse(
        res,
        400,
        false,
        "Please upload a valid resume file (PDF, DOC, or DOCX)."
      );
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "placify_resumes",
          resource_type: "raw",
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    // Update user with new resume URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { resume: result.secure_url },
      { new: true, runValidators: true }
    ).select("-password");

    // Check if profile is now complete
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    console.log("Resume uploaded successfully:", {
      userId: updatedUser._id,
      resume: result.secure_url,
      profileCompleted: updatedUser.profileCompleted,
    });

    return sendResponse(
      res,
      200,
      true,
      "Resume uploaded successfully",
      updatedUser
    );
  } catch (err) {
    console.error("Upload Resume Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    
    // Handle file size errors
    if (err.message && (err.message.includes('File size') || err.http_code === 400)) {
      return sendResponse(
        res,
        400,
        false,
        "Resume file is too large. Please upload a file smaller than 5MB."
      );
    }
    
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while uploading your resume. Please try again later."
    );
  }
};

export const deleteResume = async (req, res) => {
  try {
    // Remove resume URL from user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { resume: "" },
      { new: true, runValidators: true }
    ).select("-password");

    // Check if profile is still complete
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
    return sendResponse(
      res,
      500,
      false,
      "Something went wrong while deleting your resume. Please try again later."
    );
  }
};
