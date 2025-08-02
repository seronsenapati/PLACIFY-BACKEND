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

import "./cronJobs/autoCleanup.js"; // Importing the auto cleanup job

dotenv.config();

const app = express();

// Set default port to 5001 since 5000 is in use by another process
const DEFAULT_PORT = 5001;
const PORT = process.env.PORT || DEFAULT_PORT;

app.use(cors());
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

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/ai", jobGeneration);
app.use("/api/admin", adminRoutes);

// Handle undefined routes
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `🔍 Route not found: ${req.originalUrl}`,
  });
});

const startServer = async () => {
  try {
    await connectDB();
    
    // Create server instance
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE' && PORT !== DEFAULT_PORT) {
        console.log(`Port ${PORT} is in use, trying port ${DEFAULT_PORT}...`);
        // Try to start server on default port
        const newServer = app.listen(DEFAULT_PORT, () => {
          console.log(`🚀 Server is running on http://localhost:${DEFAULT_PORT}`);
        });
        
        newServer.on('error', (err) => {
          console.error('Failed to start server:', err);
          process.exit(1);
        });
      } else {
        console.error('Failed to start server:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
