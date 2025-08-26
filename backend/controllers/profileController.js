// controllers/profileController.js
import streamifier from "streamifier";
import cloudinary from "../utils/cloudinary.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import sendResponse from "../utils/sendResponse.js";

function isProfileComplete(user) {
  return (
    user.username && 
    user.about &&
    user.about.gender &&
    user.about.location &&
    user.about.primaryRole &&
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
    console.error("Get Profile Error:", err);
    return sendResponse(res, 500, false, "Server error");
  }
};

// UPDATE Profile
export const updateProfile = async (req, res) => {
  try {
    let updateData = { ...req.body };

    // ✅ Profile Photo Upload
    if (req.file && req.file.fieldname === "profilePhoto") {
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
    }

    // ✅ Resume Upload
    if (req.file && req.file.fieldname === "resume") {
      const streamUpload = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "placify_resumes", resource_type: "raw", format: "pdf" },
            (error, result) => (result ? resolve(result) : reject(error))
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

      const result = await streamUpload();
      updateData.resume = result.secure_url;
    }

    // ✅ Parse JSON fields if sent as strings
    if (updateData.skills && typeof updateData.skills === "string") {
      updateData.skills = JSON.parse(updateData.skills);
    }
    if (updateData.education && typeof updateData.education === "string") {
      updateData.education = JSON.parse(updateData.education);
    }
    if (
      updateData.socialProfiles &&
      typeof updateData.socialProfiles === "string"
    ) {
      updateData.socialProfiles = JSON.parse(updateData.socialProfiles);
    }
    if (updateData.about && typeof updateData.about === "string") {
      updateData.about = JSON.parse(updateData.about);
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) return sendResponse(res, 404, false, "User not found");

    // ✅ Profile Completion Flag
    const profileCompleted = isProfileComplete(updatedUser);
    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    return sendResponse(res, 200, true, "Profile updated", updatedUser);
  } catch (err) {
    console.error("Update Profile Error:", err);
    return sendResponse(res, 500, false, "Server error");
  }
};
