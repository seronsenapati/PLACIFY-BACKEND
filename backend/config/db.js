// config/db.js
// This file handles MongoDB connection using Mongoose

import mongoose from "mongoose";

/**
 * Connects to MongoDB using the connection string from environment variables.
 * If connection fails, logs the error and exits the process.
 */
export const connectDB = async () => {
  try {
    // Log the connection attempt (without exposing credentials)
    const uriWithoutCredentials = process.env.MONGO_URI.replace(/\/\/.*@/, '//****:****@');
    console.log(`Attempting to connect to MongoDB at: ${uriWithoutCredentials}`);
    
    // Add connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of default 30s
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    await mongoose.connect(process.env.MONGO_URI, options);

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error("Error code:", error.code);
    console.error("Error name:", error.name);
    
    // Additional error details for debugging
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    // Handle specific error types
    if (error.name === 'MongooseServerSelectionError') {
      console.error("🔧 Troubleshooting tips:");
      console.error("  1. Check your internet connection");
      console.error("  2. Verify the MongoDB URI is correct");
      console.error("  3. Ensure your IP address is whitelisted in MongoDB Atlas");
      console.error("     ➤ Go to MongoDB Atlas > Network Access > Add IP Address");
      console.error("     ➤ Add your current IP or use 0.0.0.0/0 for development only");
      console.error("  4. Check if your MongoDB cluster is active");
      console.error("  5. Try using a local MongoDB instance for development:");
      console.error("     ➤ Install MongoDB locally: https://docs.mongodb.com/manual/installation/");
      console.error("     ➤ Create a .env.local file with: MONGO_URI=mongodb://localhost:27017/placify");
    }
    
    console.error(error.stack); // Helpful for debugging
    
    process.exit(1); // Exit the process with failure code
  }
};

export default connectDB;