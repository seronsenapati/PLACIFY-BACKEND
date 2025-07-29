import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";
import sendResponse from "../utils/sendResponse.js";

dotenv.config();

// REGISTER USER
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendResponse(res, 400, false, "User already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    const token = jwt.sign(
      { email: newUser.email, id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userWithoutPassword = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendResponse(
      res,
      201,
      true,
      "User registered successfully",
      { user: userWithoutPassword, token }
    );
  } catch (err) {
    console.error("Register Error:", err);
    return sendResponse(res, 500, false, "Server Error");
  }
};

// LOGIN USER
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
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
      email: user.email,
      role: user.role,
    };

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendResponse(
      res,
      200,
      true,
      "Login successful",
      { user: userWithoutPassword, token }
    );
  } catch (error) {
    console.error("Login Error:", error);
    return sendResponse(res, 500, false, "Server Error");
  }
};

//Logout User
export const logoutUser = (req, res) => {
  try {
    res.clearCookie("token");
    return sendResponse(res, 200, true, "Logout successful");
  } catch (error) {
    console.error("Logout Error:", error);
    return sendResponse(res, 500, false, "Server Error");
  }
};
