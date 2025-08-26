import bcrypt from "bcryptjs";
import User from "../models/User.js";
import sendResponse from "../utils/sendResponse.js";
import cloudinary from "../utils/cloudinary.js";
import streamifier from "streamifier";

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
