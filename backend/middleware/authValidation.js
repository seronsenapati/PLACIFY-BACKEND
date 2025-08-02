import sendResponse from "../utils/sendResponse.js";

// Input validation middleware for registration
export const validateRegistration = (req, res, next) => {
  let { name, email, password, role = "student" } = req.body;

  // Trim and normalize
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return sendResponse(res, 400, false, "Invalid input types");
  }

  name = name.trim();
  email = email.trim().toLowerCase();
  password = password.trim();
  role = role.trim().toLowerCase();

  // Check required fields
  if (!name || !email || !password) {
    return sendResponse(
      res,
      400,
      false,
      "Name, email, and password are required"
    );
  }

  // Validate name (alphanumeric with spaces, 2-50 chars)
  const nameRegex = /^[a-zA-Z\s]{2,50}$/;
  if (!nameRegex.test(name)) {
    return sendResponse(
      res,
      400,
      false,
      "Name must be 2-50 characters and contain only letters and spaces"
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(
      res,
      400,
      false,
      "Please provide a valid email address"
    );
  }

  // Validate password strength
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return sendResponse(
      res,
      400,
      false,
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
    );
  }

  // Restrict role to 'student' or 'recruiter'
  const allowedRoles = ["student", "recruiter"];
  if (!allowedRoles.includes(role)) {
    return sendResponse(
      res,
      400,
      false,
      `Invalid role. Role must be one of: ${allowedRoles.join(", ")}`
    );
  }

  next();
};
