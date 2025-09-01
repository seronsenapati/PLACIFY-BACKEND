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
      return sendResponse(res, 400, false, "Email is already taken");
    }

    // Check if username already used by someone else
    const existingUsername = await User.findOne({
      username,
      _id: { $ne: userId },
    });
    if (existingUsername) {
      return sendResponse(res, 400, false, "Username is already taken");
    }

    let profilePhotoUrl;

    // If profile pic uploaded, push to Cloudinary
    if (req.file) {
      const streamUpload = () => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_profile_photos",
              resource_type: "image",
            },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      };
      const result = await streamUpload();
      profilePhotoUrl = result.secure_url;
    }

    const updateData = { name, username, email };
    if (profilePhotoUrl) updateData.profilePhoto = profilePhotoUrl;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      updatedUser
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
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return sendResponse(res, 400, false, "All password fields are required");
    }

    if (newPassword !== confirmNewPassword) {
      return sendResponse(
        res,
        400,
        false,
        "New password and confirmation do not match"
      );
    }

    const user = await User.findById(userId).select("password");
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
