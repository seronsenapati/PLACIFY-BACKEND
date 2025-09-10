// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";
import sendResponse from "../utils/sendResponse.js";

dotenv.config();

// helper to normalize email
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : email;

// REGISTER USER
export const registerUser = async (req, res) => {
  try {
    let { name, email, password, username, role } = req.body; 
    email = normalizeEmail(email);

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof username !== "string"
    ) {
      return sendResponse(
        res,
        400,
        false,
        "Invalid input types. Name, email, password, and username must be strings"
      );
    }

    name = name.trim();
    password = password.trim();
    username = username.trim();

    // Check if user already exists by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendResponse(
        res,
        400,
        false,
        "User already exists with this email"
      );
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return sendResponse(res, 400, false, "Username already taken");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Ensure role is properly set
    // The validation middleware should have already handled this, but we'll double-check
    const validRoles = ["student", "recruiter"];
    if (!role || !validRoles.includes(role)) {
      role = "student"; // Default to student if role is missing or invalid
    }

    // Explicitly set the role in the data object to avoid undefined values
    const userData = {
      name,
      email,
      username,
      password: hashedPassword,
      role: role // This ensures we're explicitly passing the role
    };

    // Create new user with the role from request body
    const newUser = await User.create(userData);

    // create token
    const token = jwt.sign(
      { email: newUser.email, id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userWithoutPassword = {
      _id: newUser._id,
      name: newUser.name,
      username: newUser.username, 
      email: newUser.email,
      role: newUser.role,
    };

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendResponse(res, 201, true, "User registered successfully", {
      user: userWithoutPassword,
      token,
    });
  } catch (err) {
    console.error("Register Error:", err);
    return sendResponse(res, 500, false, "Server Error");
  }
};

// LOGIN USER
export const loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;
    email = normalizeEmail(email);

    if (typeof email !== "string" || typeof password !== "string") {
      return sendResponse(
        res,
        400,
        false,
        "Email and password must be strings"
      );
    }

    password = password.trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendResponse(
        res,
        400,
        false,
        "Please provide a valid email address"
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      return sendResponse(res, 401, false, "Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse(res, 401, false, "Invalid credentials");
    }

    const token = jwt.sign(
      { email: user.email, id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userWithoutPassword = {
      _id: user._id,
      name: user.name,
      username: user.username, 
      email: user.email,
      role: user.role,
    };

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendResponse(res, 200, true, "Login successful", {
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return sendResponse(res, 500, false, "Server Error");
  }
};

// LOGOUT USER
export const logoutUser = (req, res) => {
  try {
    res.clearCookie("token");
    return sendResponse(res, 200, true, "Logout successful");
  } catch (error) {
    console.error("Logout Error:", error);
    return sendResponse(res, 500, false, "Server Error");
  }
};

// GET CURRENT USER
export const getCurrentUser = async (req, res) => {
  try {
    console.log("GET Current User request:", { userId: req.user._id });

    const user = await User.findById(req.user._id).select("-password -__v");
    if (!user) {
      console.log("User not found:", req.user._id);
      return sendResponse(res, 404, false, "User not found");
    }

    // For recruiters, also populate company information
    if (user.role === "recruiter" && user.company) {
      const company = await Company.findById(user.company).select(
        "name location desc website logo createdAt updatedAt"
      );

      console.log("Recruiter user fetched with company:", {
        userId: user._id,
        hasCompany: !!company,
      });

      return sendResponse(res, 200, true, "User fetched", {
        user: {
          ...user.toObject(),
          company: company || null,
        }
      });
    }

    console.log("User fetched:", {
      userId: user._id,
      role: user.role,
    });

    return sendResponse(res, 200, true, "User fetched", { user });
  } catch (err) {
    console.error("🔴 [Get Current User Error]:", err);
    return sendResponse(res, 500, false, "Server error");
  }
};
