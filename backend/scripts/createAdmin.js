import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import User from "../models/User.js";
import { connectDB } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the .env file in the backend directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Connect to database
connectDB();

const createAdmin = async () => {
  try {
    const name = process.env.ADMIN_NAME || "Admin User";
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.error(
        "❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in the .env file."
      );
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log("ℹ️ Admin user already exists.");
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    console.log("✅ Admin user created successfully!");
    console.log("🆔 ID:", admin._id.toString());
    console.log("🛡️ Role:", admin.role);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
};

createAdmin();
