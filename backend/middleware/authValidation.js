import sendResponse from "../utils/sendResponse.js";

// ✅ Registration validation middleware
export const validateRegistration = (req, res, next) => {
  let { name, email, password, role = "student" } = req.body;

  // Type check
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return sendResponse(res, 400, false, "Invalid input types");
  }

  // Trim and normalize
  name = name.trim();
  email = email.trim().toLowerCase();
  password = password.trim();
  role = role.trim().toLowerCase();

  // Required fields
  if (!name || !email || !password) {
    return sendResponse(
      res,
      400,
      false,
      "Name, email, and password are required"
    );
  }

  // Name validation (only letters + spaces, 2–50 chars)
  const nameRegex = /^[a-zA-Z\s]{2,50}$/;
  if (!nameRegex.test(name)) {
    return sendResponse(
      res,
      400,
      false,
      "Name must be 2–50 characters and contain only letters and spaces"
    );
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(
      res,
      400,
      false,
      "Please provide a valid email address"
    );
  }

  // Password strength validation
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return sendResponse(
      res,
      400,
      false,
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
    );
  }

  // Allowed roles
  const allowedRoles = ["student", "recruiter"];
  if (!allowedRoles.includes(role)) {
    return sendResponse(
      res,
      400,
      false,
      `Invalid role. Role must be one of: ${allowedRoles.join(", ")}`
    );
  }

  // Pass data forward
  req.body = { name, email, password, role };
  next();
};

// ✅ Login validation middleware
export const validateLogin = (req, res, next) => {
  let { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string") {
    return sendResponse(res, 400, false, "Email and password must be strings");
  }

  email = email.trim().toLowerCase();
  password = password.trim();

  if (!email || !password) {
    return sendResponse(res, 400, false, "Email and password are required");
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(
      res,
      400,
      false,
      "Please provide a valid email address"
    );
  }

  req.body = { email, password };
  next();
};
