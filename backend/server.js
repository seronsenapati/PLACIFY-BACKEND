import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import authRoutes from "./routes/authRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import bookmarkRoutes from "./routes/bookmarkRoutes.js";
import jobGeneration from "./routes/jobGenAIRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

// Load environment variables from .env file
dotenv.config();

// Load local environment variables if .env.local exists (for development overrides)
// This allows you to override environment variables for local development
// without modifying the main .env file
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists (for local development overrides)
const envLocalPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log("Loaded .env.local file");
}

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, please try again later",
});
app.use(limiter);

app.get("/", (req, res) => {
  res.send("Welcome to Placify API");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/ai", jobGeneration);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);

// 404 handler
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `🔍 Route not found: ${req.originalUrl}`,
  });
});

// Graceful shutdown
let server;

// Start server
const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("MongoDB connected successfully");
    
    // Import and start cron jobs only in production or if explicitly enabled
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
      console.log("Starting cron jobs...");
      
      // Import cron jobs dynamically
      const { default: startAutoCleanupCron } = await import('./cronJobs/autoCleanup.js');
      const { startRecruiterNotificationCron } = await import('./cronJobs/recruiterNotifications.js');
      
      // Start cron jobs
      startAutoCleanupCron();
      startRecruiterNotificationCron();
    } else {
      console.log("⏭️  Cron jobs skipped (not in production and not explicitly enabled)");
    }
    
    server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
    
    // Handle server errors
    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      process.exit(1);
    });
    
    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log("🛑 Received shutdown signal, shutting down gracefully...");
      server.close(() => {
        console.log("✅ Server closed successfully");
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error("💥 Force shutdown after 10 seconds");
        process.exit(1);
      }, 10000);
    };
    
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;