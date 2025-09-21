import bcrypt from "bcryptjs";
import User from "../models/User.js";
import sendResponse from "../utils/sendResponse.js";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";
import { NOTIFICATION_TYPES } from "../utils/notificationHelpers.js";

// ✅ Get Profile Info (for Settings page)
export const getProfileInfo = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    return sendResponse(res, 200, true, "Profile fetched successfully", user);
  } catch (error) {
    console.error("[getProfileInfo] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Update Profile Info: name, username, email, profilePic
export const updateProfileInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, username, email } = req.body;

    if (!name || !username || !email) {
      return sendResponse(
        res,
        400,
        false,
        "Name, username and email are required"
      );
    }

    // Check if email already used by someone else
    const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
    if (existingEmail) {
      return sendResponse(res, 400, false, "Email already in use");
    }

    // Check if username already used by someone else
    const existingUsername = await User.findOne({
      username,
      _id: { $ne: userId },
    });
    if (existingUsername) {
      return sendResponse(res, 400, false, "Username already in use");
    }

    let updateData = { name, username, email };

    // Handle profile photo upload
    if (req.file) {
      try {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_profile_photos",
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

        updateData.profilePhoto = result.secure_url;
      } catch (uploadError) {
        console.error("[Profile Photo Upload Error]:", uploadError);
        
        // Handle Cloudinary upload errors
        if (uploadError.message && uploadError.message.includes('Invalid image file')) {
          return sendResponse(
            res,
            400,
            false,
            "Please upload a valid image file (JPEG, PNG, GIF)."
          );
        }
        
        // Handle file size errors
        if (uploadError.message && uploadError.message.includes('File size')) {
          return sendResponse(
            res,
            400,
            false,
            "Profile photo is too large. Please upload an image smaller than 3MB."
          );
        }
        
        return sendResponse(
          res,
          500,
          false,
          "Something went wrong while uploading your profile photo. Please try again later."
        );
      }
    }

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      user
    );
  } catch (error) {
    console.error("[updateProfileInfo] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Change Password
export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendResponse(
        res,
        400,
        false,
        "Current password and new password are required"
      );
    }

    if (newPassword.length < 6) {
      return sendResponse(
        res,
        400,
        false,
        "New password must be at least 6 characters"
      );
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return sendResponse(res, 401, false, "Current password is incorrect");
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return sendResponse(res, 200, true, "Password changed successfully");
  } catch (error) {
    console.error("[changePassword] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Get Notification Preferences
export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("notificationPreferences");
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Ensure default preferences exist if not set
    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
      await user.save();
    }

    return sendResponse(
      res,
      200,
      true,
      "Notification preferences fetched successfully",
      user.notificationPreferences
    );
  } catch (error) {
    console.error("[getNotificationPreferences] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Update Notification Preferences
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const preferences = req.body;

    // Validate the structure of preferences
    const validChannels = ['email', 'push', 'inApp'];
    const validTypes = Object.values(NOTIFICATION_TYPES);

    // Validate preferences structure
    for (const channel of validChannels) {
      if (preferences[channel]) {
        // Validate enabled field
        if (preferences[channel].enabled !== undefined && typeof preferences[channel].enabled !== 'boolean') {
          return sendResponse(res, 400, false, `Invalid ${channel}.enabled value. Must be boolean.`);
        }

        // Validate types
        if (preferences[channel].types) {
          for (const type in preferences[channel].types) {
            if (!validTypes.includes(type)) {
              return sendResponse(res, 400, false, `Invalid notification type: ${type}`);
            }
            if (typeof preferences[channel].types[type] !== 'boolean') {
              return sendResponse(res, 400, false, `Invalid ${channel}.types.${type} value. Must be boolean.`);
            }
          }
        }
      }
    }

    // Validate quiet hours if provided
    if (preferences.quietHours) {
      const { enabled, start, end, timezone } = preferences.quietHours;
      
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        return sendResponse(res, 400, false, "Invalid quietHours.enabled value. Must be boolean.");
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (start && !timeRegex.test(start)) {
        return sendResponse(res, 400, false, "Invalid quietHours.start format. Use HH:MM format.");
      }
      if (end && !timeRegex.test(end)) {
        return sendResponse(res, 400, false, "Invalid quietHours.end format. Use HH:MM format.");
      }

      if (timezone && typeof timezone !== 'string') {
        return sendResponse(res, 400, false, "Invalid quietHours.timezone value. Must be string.");
      }
    }

    // Update user preferences
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        $set: {
          notificationPreferences: {
            ...preferences
          }
        }
      },
      { new: true, runValidators: true }
    ).select("notificationPreferences");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    return sendResponse(
      res,
      200,
      true,
      "Notification preferences updated successfully",
      user.notificationPreferences
    );
  } catch (error) {
    console.error("[updateNotificationPreferences] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Reset Notification Preferences to Default
export const resetNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    // Reset to default preferences by unsetting and letting defaults apply
    const user = await User.findByIdAndUpdate(
      userId,
      { $unset: { notificationPreferences: 1 } },
      { new: true }
    );

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Get the user again to get default preferences
    const updatedUser = await User.findById(userId).select("notificationPreferences");

    return sendResponse(
      res,
      200,
      true,
      "Notification preferences reset to default",
      updatedUser.notificationPreferences
    );
  } catch (error) {
    console.error("[resetNotificationPreferences] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Get Recruiter Settings
export const getRecruiterSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user is a recruiter and get user data
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.role !== "recruiter") {
      return sendResponse(res, 403, false, "Access denied. Recruiter access required.");
    }

    // Ensure recruiter settings exist
    if (!user.recruiterSettings) {
      user.recruiterSettings = {};
      await user.save();
    }

    return sendResponse(
      res,
      200,
      true,
      "Recruiter settings fetched successfully",
      user.recruiterSettings
    );
  } catch (error) {
    console.error("[getRecruiterSettings] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Update Recruiter Settings
export const updateRecruiterSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const settings = req.body;

    // Check if user is a recruiter and get user data
    const user = await User.findById(userId);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.role !== "recruiter") {
      return sendResponse(res, 403, false, "Access denied. Recruiter access required.");
    }

    // Validate settings
    const validSettings = {};
    
    // Validate numeric settings
    if (settings.defaultJobExpirationDays !== undefined) {
      const value = parseInt(settings.defaultJobExpirationDays);
      if (isNaN(value) || value < 1 || value > 365) {
        return sendResponse(res, 400, false, "defaultJobExpirationDays must be between 1 and 365");
      }
      validSettings.defaultJobExpirationDays = value;
    }
    
    if (settings.defaultApplicationDeadlineDays !== undefined) {
      const value = parseInt(settings.defaultApplicationDeadlineDays);
      if (isNaN(value) || value < 1 || value > 365) {
        return sendResponse(res, 400, false, "defaultApplicationDeadlineDays must be between 1 and 365");
      }
      validSettings.defaultApplicationDeadlineDays = value;
    }
    
    if (settings.jobExpirationNotificationDays !== undefined) {
      const value = parseInt(settings.jobExpirationNotificationDays);
      if (isNaN(value) || value < 1 || value > 30) {
        return sendResponse(res, 400, false, "jobExpirationNotificationDays must be between 1 and 30");
      }
      validSettings.jobExpirationNotificationDays = value;
    }
    
    if (settings.applicationReviewThreshold !== undefined) {
      const value = parseInt(settings.applicationReviewThreshold);
      if (isNaN(value) || value < 1 || value > 100) {
        return sendResponse(res, 400, false, "applicationReviewThreshold must be between 1 and 100");
      }
      validSettings.applicationReviewThreshold = value;
    }
    
    // Validate boolean settings
    if (settings.notifyBeforeJobExpiration !== undefined) {
      if (typeof settings.notifyBeforeJobExpiration !== 'boolean') {
        return sendResponse(res, 400, false, "notifyBeforeJobExpiration must be boolean");
      }
      validSettings.notifyBeforeJobExpiration = settings.notifyBeforeJobExpiration;
    }
    
    if (settings.autoReviewApplications !== undefined) {
      if (typeof settings.autoReviewApplications !== 'boolean') {
        return sendResponse(res, 400, false, "autoReviewApplications must be boolean");
      }
      validSettings.autoReviewApplications = settings.autoReviewApplications;
    }
    
    // Validate dashboard metrics
    if (settings.dashboardMetrics !== undefined) {
      if (!Array.isArray(settings.dashboardMetrics)) {
        return sendResponse(res, 400, false, "dashboardMetrics must be an array");
      }
      
      const validMetrics = [
        'totalJobs',
        'activeJobs',
        'expiredJobs',
        'totalApplications',
        'pendingApplications',
        'reviewedApplications',
        'rejectedApplications'
      ];
      
      const invalidMetrics = settings.dashboardMetrics.filter(metric => !validMetrics.includes(metric));
      if (invalidMetrics.length > 0) {
        return sendResponse(res, 400, false, `Invalid dashboard metrics: ${invalidMetrics.join(', ')}`);
      }
      
      validSettings.dashboardMetrics = settings.dashboardMetrics;
    }
    
    // Validate export format
    if (settings.defaultExportFormat !== undefined) {
      const validFormats = ['csv', 'json'];
      if (!validFormats.includes(settings.defaultExportFormat)) {
        return sendResponse(res, 400, false, "defaultExportFormat must be 'csv' or 'json'");
      }
      validSettings.defaultExportFormat = settings.defaultExportFormat;
    }

    // Update recruiter settings
    user.recruiterSettings = {
      ...user.recruiterSettings,
      ...validSettings
    };
    
    await user.save();

    return sendResponse(
      res,
      200,
      true,
      "Recruiter settings updated successfully",
      user.recruiterSettings
    );
  } catch (error) {
    console.error("[updateRecruiterSettings] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// ✅ Reset Recruiter Settings to Default
export const resetRecruiterSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user is a recruiter and reset settings
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $unset: { recruiterSettings: 1 } },
      { new: true }
    );

    if (!updatedUser) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (updatedUser.role !== "recruiter") {
      return sendResponse(res, 403, false, "Access denied. Recruiter access required.");
    }

    // Get the user again to get default settings
    const userWithDefaults = await User.findById(userId).select("recruiterSettings");

    return sendResponse(
      res,
      200,
      true,
      "Recruiter settings reset to default",
      userWithDefaults.recruiterSettings
    );
  } catch (error) {
    console.error("[resetRecruiterSettings] Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};