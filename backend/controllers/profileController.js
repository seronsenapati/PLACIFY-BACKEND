import streamifier from "streamifier";
import cloudinary from "../utils/cloudinary.js";

function isProfileComplete(user) {
  return (
    user.about &&
    user.about.fullName &&
    user.about.experience !== undefined &&
    user.skills &&
    user.skills.length > 0 &&
    user.education &&
    user.education.length > 0 &&
    user.profilePhoto // now profile photo is required for completion
  );
}

// GET Profile (add profilePhoto to returned user)
export const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("-password -__v");

    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (user.role === "recruiter") {
      const company = await Company.findById(user.company).select(
        "name location desc website logo createdAt updatedAt"
      );

      return sendResponse(res, 200, true, "Profile fetched successfully", {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        profileCompleted: user.profileCompleted,
        profilePhoto: user.profilePhoto,
        company: company || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    }

    // For students
    return sendResponse(res, 200, true, "Profile fetched successfully", user);
  } catch (error) {
    console.error("Get Profile Error:", error);
    return sendResponse(res, 500, false, "Server error");
  }
};

// PATCH Update Profile (handle profilePhoto upload)
export const updateProfile = async (req, res) => {
  try {
    let updateData = req.body;

    // If file is sent, upload to Cloudinary and add profilePhoto url to updateData
    if (req.file) {
      const streamUpload = () => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "placify_profilePhotos",
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
      updateData.profilePhoto = result.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return sendResponse(res, 404, false, "User not found");
    }

    // Check profile completion (including profilePhoto now)
    const profileCompleted = isProfileComplete(updatedUser);

    if (profileCompleted !== updatedUser.profileCompleted) {
      updatedUser.profileCompleted = profileCompleted;
      await updatedUser.save();
    }

    return sendResponse(
      res,
      200,
      true,
      "Profile updated successfully",
      updatedUser
    );
  } catch (error) {
    console.error("Update Profile Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendResponse(res, 400, false, messages.join(", "));
    }
    return sendResponse(res, 500, false, "Server error");
  }
};
