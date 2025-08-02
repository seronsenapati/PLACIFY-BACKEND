import express from "express";
import {
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  getSystemStats,
} from "../controllers/adminController.js";
import protect from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/rbacMiddleware.js";
import validateRequest from "../middleware/validate.js";

const router = express.Router();

// Apply authentication and RBAC for admin role to all routes
router.use(protect, isAdmin);

// Routes
router.get("/users", getAllUsers);
router.patch("/users/:userId/status", validateRequest, toggleUserStatus);
router.delete("/users/:userId", validateRequest, deleteUser);
router.get("/stats", getSystemStats);

export default router;
