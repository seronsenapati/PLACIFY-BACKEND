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

import "./cronJobs/autoCleanup.js"; // Importing the auto cleanup job

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "*", // Optional: Replace with frontend domain after deployment
    credentials: true,
  })
);

app.use(express.json());
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

// 404 handler
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `🔍 Route not found: ${req.originalUrl}`,
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }
};

startServer();
