// config/db.js
// This file handles MongoDB connection using Mongoose

import mongoose from "mongoose";

/**
 * Connects to MongoDB using the connection string from environment variables.
 * If connection fails, logs the error and exits the process.
 */
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error(error.stack); // Helpful for debugging
    process.exit(1); // Exit the process with failure code
  }
};

export default connectDB;
