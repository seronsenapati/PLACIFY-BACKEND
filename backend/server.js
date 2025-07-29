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

import "./cronJobs/autoCleanup.js"; // Importing the auto cleanup job

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
});
