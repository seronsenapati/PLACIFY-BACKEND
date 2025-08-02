import sendResponse from "../utils/sendResponse.js";

/**
 * Middleware to check if user has one of the allowed roles
 * @param {Array} allowedRoles - Array of roles that are allowed to access the route
 * @returns {Function} Express middleware function
 */
export const checkRole = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        return sendResponse(
          res,
          500,
          false,
          "RBAC misconfiguration: No roles specified"
        );
      }

      if (!req.user) {
        return sendResponse(res, 401, false, "Authentication required");
      }

      const userRole = req.user.role?.toLowerCase();

      if (!allowedRoles.includes(userRole)) {
        return sendResponse(
          res,
          403,
          false,
          "You do not have permission to perform this action"
        );
      }

      next();
    } catch (error) {
      console.error("RBAC Middleware Error:", error);
      return sendResponse(
        res,
        500,
        false,
        "Server error during role verification"
      );
    }
  };
};

/**
 * Allow only admin users
 */
export const isAdmin = checkRole(["admin"]);

/**
 * Allow only recruiter or admin users
 */
export const isRecruiter = checkRole(["recruiter"]);

/**
 * Allow only student users
 */
export const isStudent = checkRole(["student"]);

/**
 * Allow recruiter or admin
 */
export const isRecruiterOrAdmin = checkRole(["recruiter", "admin"]);

export const isRecruiterOrStudent = checkRole(["recruiter", "student"]);

export default {
  checkRole,
  isAdmin,
  isRecruiter,
  isStudent,
  isRecruiterOrAdmin,
  isRecruiterOrStudent,
};
