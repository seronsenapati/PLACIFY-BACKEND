import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import path from "path";
import User from "../models/User.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/placify";

const migrate = async () => {
  try {
    console.log("🚀 Starting database migration...");

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.info("✅ Connected to MongoDB");

    // 1. Add isActive field to all users if not already present
    const updateResult = await User.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );
    console.info(
      `✅ Updated ${updateResult.modifiedCount} users with isActive field`
    );

    // 2. Create an admin user if none exists
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Admin User";

    if (!adminEmail || !adminPassword) {
      console.error(
        "❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in the .env file."
      );
      process.exit(1);
    }

    const existingAdmin = await User.findOne({ role: "admin" });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        isActive: true,
      });

      console.info("✅ Created default admin user");
      console.log("📧 Email:", adminEmail);
      console.warn(
        "⚠️  IMPORTANT: Change the default admin password immediately after first login!"
      );
    } else {
      console.info("ℹ️  Admin user already exists");
    }

    console.log("✨ Database migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

migrate();
